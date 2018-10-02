"use strict";

const request = require("request-promise-native");
const square = require("square-connect");
const AWS = require("aws-sdk");
const uuid = require("uuid/v4");

AWS.config.setPromisesDependency(null);
const SES = new AWS.SES();

function sendEmail(formData) {
  const emailParams = {
    Source: process.env.SRC_ADDRESS,
    ReplyToAddresses: [formData.email],
    Destination: {
      ToAddresses: [process.env.DEST_ADDRESS]
    },
    Message: {
      Body: {
        Text: {
          Charset: "UTF-8",
          Data: `Name: ${formData.name}
Email: ${formData.email}
${formData.phone ? `Phone: ${formData.phone}` : ""}
Message: ${formData.note}`
        }
      },
      Subject: {
        Charset: "UTF-8",
        Data: "OSC contact form submission"
      }
    }
  };

  return SES.sendEmail(emailParams).promise();
}

module.exports.processdonation = async (event, context) => {
  const body = JSON.parse(event.body);
  let amount = parseFloat(body.amount);
  if (isNaN(amount)) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: {
          code: 400,
          message: "Invalid amount: " + amount
        }
      })
    };
  }

  const trxID = uuid();

  const defaultClient = square.ApiClient.instance;
  const oauth2 = defaultClient.authentications["oauth2"];
  oauth2.accessToken = process.env.SQUARE_ACCESS_TOKEN;

  const api = new square.TransactionsApi();
  const chargeRequest = new square.ChargeRequest(trxID, {
    amount: Math.round(amount * 100),
    currency: "USD"
  });
  chargeRequest.card_nonce = body.nonce;
  chargeRequest.billing_address = new square.Address({
    address_line_1: body.street,
    locality: body.city,
    administrative_district_level_1: body.state,
    postal_code: body.zip,
    country: "US"
  });
  chargeRequest.buyer_email_address = body.email;

  let result = {
    headers: {
      "Access-Control-Allow-Origin": "*"
    }
  };

  try {
    let resp = await api.charge(process.env.LOCATION_ID, chargeRequest);
    result.body = JSON.stringify(resp);
    result.statusCode = 200;

    await SES.sendEmail({
      Source: process.env.SRC_ADDRESS,
      ReplyToAddresses: [],
      Destination: {
        ToAddresses: [process.env.DEST_ADDRESS]
      },
      Message: {
        Body: {
          Text: {
            Charset: "UTF-8",
            Data: `Amount: ${body.amount}
            
Name: ${body.name}
Email: ${body.email}
Address: ${body.street}
         ${body.city}, ${body.state} ${body.zip}
Phone: ${body.phone}
Note: ${body.note}`
          }
        },
        Subject: {
          Charset: "UTF-8",
          Data: "OSC donation processed"
        }
      }
    }).promise();
  } catch (err) {
    result.body = JSON.stringify(err);
    result.statusCode = 400;
  } finally {
    return result;
  }
};

module.exports.contactform = async (event, context) => {
  // parse the form data
  const body = JSON.parse(event.body);
  let result = undefined;

  if (context.invokeid != "id") {
    // test, do not recaptcha
    // build the options for the reCaptcha validation request
    const opts = {
      method: "POST",
      uri: "https://www.google.com/recaptcha/api/siteverify",
      formData: {
        secret: process.env.RECAPTCHA_SECRET,
        response: body["g-recaptcha-response"]
      },
      json: true
    };

    // send the request and handle appropriately
    result = await request.post(opts);
    if (!result.success) {
      return {
        statusCode: 403,
        headers: {
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          error: {
            code: 403,
            message: "reCaptcha failed: score " + result.score
          }
        })
      };
    }
  }

  const ret = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: ""
  };

  // send the email
  result = await sendEmail(body)
    .then(res => {
      ret.body = JSON.stringify(res);
    })
    .catch(err => {
      ret.statusCode = err.statusCode;
      ret.body = JSON.stringify(err);
    });

  return ret;

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
