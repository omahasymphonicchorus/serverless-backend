'use strict';

const request = require('request-promise-native');

module.exports.contactform = async (event, context) => {
  
  // parse the form data
  const formData = JSON.parse(event.body);

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
  let result = await request.post(opts)
  if(!result.success) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 403,
          message: "reCaptcha failed: score " + result.score
        }
      })
    }
  }
  
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      message: 'Go Serverless v1.0! Your function executed successfully!',
      input: event,
      result: result
    }),
  };

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
