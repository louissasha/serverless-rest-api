/**
 *  this function should create a new document
 *
 * Steps:
 *  import aws tools to make the connections from aws-sdk
 *  create a document client instance but instantiating the documentClient object ex: const docClient = new AWS.DynamoDB.DocumentClient()
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import AWS from "aws-sdk";
import { v4 } from "uuid";
import * as yup from "yup";

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = "ProductsTableServerless";

//add headers to the application
const headers = {
  "content-type": "application/json",
};
const dir = __dirname;
const fileName = __filename;

const schema = yup.object().shape({
  name: yup.string().required(),
  description: yup.string().required(),
  price: yup.number().required(),
  available: yup.bool().required(),
});

//create a reusable error object to be used for error handling when we are unable to find the product from the database
class HttpError extends Error {
  constructor(readonly statusCode: number, readonly body: Record<string, unknown> = {}) {
    super(JSON.stringify(body));
  }
}

const handleError = (e: unknown) => {
  if (e instanceof yup.ValidationError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        errors: e.errors,
      }),
    };
  }

  if (e instanceof SyntaxError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Invalid request body fomrat: "${e.message}"` }),
    };
  }
  if (e instanceof HttpError) {
    return {
      statusCode: e.statusCode,
      headers,
      body: e.message,
    };
  }

  throw e;
};

function logger(fn: any) {
  if (fn instanceof Function) {
    console.info(`Current function executed: ${fn.name}`);
  }
  console.dir(fn, { depth: null });
  // console.log(dir, fileName);
}

// reusable functions
const fetchProductById = async (id: string) => {
  const output = await docClient
    .get({
      TableName: tableName,
      Key: {
        productID: id,
      },
    })
    .promise();

  if (!output.Item) {
    // this will end the process since its not in a try catch block
    throw new HttpError(404, { error: "not found" });
  }

  //if the item exists then you can return the item
  return output.Item;
};

export const createProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // event.body will hold that body of the request when it gets passed along
  // handle the incoming boody of the request
  // JSON.parse will turn the string body into an object
  // adding validation
  try {
    const reqBody = JSON.parse(event.body as string);

    //use yup to validate the body of the request
    await schema.validate(reqBody, { abortEarly: false });

    // put new product inside of table
    const product = {
      productID: v4(),
      ...reqBody,
    };
    // going to used the spread operator to make the body into anything we want it to when we save to amazon dynamod db
    await docClient
      .put({
        TableName: tableName,
        Item: product,
      })
      .promise();
    logger(createProduct);

    return {
      // status 201 menas its created instead of just ok
      statusCode: 201,
      headers,
      body: JSON.stringify(product),
    };
  } catch (err) {
    return handleError(err);
  }
};

export const getProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // this function will be used to return a specific product based on the product id

  // use the req params to get the string id of the specific product that we want to return
  // the req params are in the envent body as pathParameters
  const id = event.pathParameters?.id as string;
  logger(getProduct);
  console.info(`Lookup id is: ${id}`);

  let product;

  try {
    product = await fetchProductById(id);
  } catch (err) {
    handleError(err);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(product),
  };
};

export const updateProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // this function will update a product

  let reqBody;
  try {
    // get the product details first for the update from the body of th event

    reqBody = JSON.parse(event.body as string);

    //use yup to validate the body of the request

    schema.validate(reqBody, { abortEarly: false });
  } catch (e) {
    handleError(e);
  }

  // get the id that we want to target from the path parameters
  const id = event.pathParameters?.id as string;
  console.log(`This is the id of the product: ${id}`);

  let outputProduct;

  try {
    outputProduct = await fetchProductById(id);

    //define the product object we want to target, we assume that since we found the itme then the id is correct
  } catch (err) {
    handleError(err);
  }

  console.log(outputProduct);

  const product = {
    ...reqBody,
    productID: outputProduct.productID,
  };

  //console.log(product);

  //using the new product we can put that in the database as a replacement for the previous product
  await docClient
    .put({
      TableName: tableName,
      Item: product,
    })
    .promise();

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify(product),
  };
};

export const deleteProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // this function will delete a product
  const id = event.pathParameters?.id as string;
  console.log(id);

  let productToDelete;
  try {
    // find the product to see if it exists
    productToDelete = await fetchProductById(id);

    //this is the product that we will delete
    logger(productToDelete);

    // delete the product if it exists
    await docClient
      .delete({
        TableName: tableName,
        Key: {
          productID: productToDelete.productID,
        },
      })
      .promise();
  } catch (err) {
    handleError(err);
  }

  return {
    statusCode: 204,
    // body: JSON.stringify(productToDelete),
    body: JSON.stringify({ result: "delete completed", product: productToDelete }),
  };
};

export const listProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // this function will list all prossible products in the database
  const output = await docClient
    .scan({
      TableName: tableName,
    })
    .promise();

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(output),
  };
};
