'use strict';

const request = require('request-promise-native');
const AWS = require('aws-sdk');

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
          Charset: 'UTF-8',
          Data: `Name: ${formData.name}
Email: ${formData.email}
${formData.phone ? `Phone: ${formData.phone}` : ''}
Message: ${formData.note}`
        }
      },
      Subject: {
        Charset: 'UTF-8',
        Data: 'OSC contact form submission'
      }
    }
  };

  return SES.sendEmail(emailParams).promise();
}

module.exports.processdonation = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Go Serverless v1.0! Your function executed successfully!",
      input: event
    })
  };
}

module.exports.contactform = async (event, context) => {
  // parse the form data
  const formData = JSON.parse(event.body);
  let result = undefined;

  if (context.invokeid != 'id') { // test, do not recaptcha
    // build the options for the reCaptcha validation request
    const opts = {
      method: 'POST',
      uri: 'https://www.google.com/recaptcha/api/siteverify',
      formData: {
        secret: process.env.RECAPTCHA_SECRET,
        response: formData['g-recaptcha-response']
      },
      json: true
    }

    // send the request and handle appropriately
    result = await request.post(opts)
    if (!result.success) {
      return {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: {
            code: 403,
            message: "reCaptcha failed: score " + result.score
          }
        })
      }
    }
  }

  const ret = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: ""
  }

  // send the email
  result = await sendEmail(formData).then(res => {
    ret.body = JSON.stringify(res);
  }).catch(err => {
    ret.statusCode = err.statusCode
    ret.body = JSON.stringify(err);
  });

  return ret;

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
