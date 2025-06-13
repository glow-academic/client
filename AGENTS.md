# How to Properly Code For This Repository


## Run
This is a monorepo. There is a client, database, and server folder. Run the following commands to start each one, in this order. Note that all of these commands will not stop without command input, so take caution and use sleep commands or run in a headless/detached fashion. 

```bash
cd database && bash run.sh --clean
```
```bash
cd client && yarn run dev
```
```bash
cd server && make run
```

## Tests
You should write test cases for your files, in order to ensure that they work with the rest of the code. Here are all of the tests for the client, server, and end-2-end.

For the client, you can use the unit tests in client/__tests__, which contains tests for at least all of the files in client/components. It uses vitest under the hood, and can be run with 

```bash
cd client && yarn test
```

For the server, you can use the unit tests in server/tests, which contains tests for at least all of the files in the client/routes and client/services folders. It uses pytest under the hood, and can be run with 

```bash
cd server && make test
```

For end-2-end testing, you can use the client/cypress folder, which will at least run tests for every table in the database, for full integration. The primary focus is if CRUD operations can be performed without error, end to end. *Note that all 3 of the database, client, and server musst be running before we can start this test*. To run the tests, use the following command:

```bash
cd client && yarn run test:cypress
```

## Typechecking

You should make sure that the typechecker passes in the client and server folders. For the client, you can use the auto generated types defined in client/types.ts. For the server, you can use the types defined in server/models.py. In a way, you can type check the database by seeing if it will run without any errors. 

To run typechecking on the client, you can run this command: 

```bash
cd client && npx tsc --noEmit
```

To run typechecking on the server, you can run this command

```bash
cd server && make typecheck
```

## Other Info
For anything else not explicty defined here, these files/folders are good places to look to get more information about each of the client/database/server. *Note that the database folders defines the source of truth for the schema and models in the client and server*.

### Client
- client/package.json
- client/drizzle/schema.ts
### Database
- database/init/**
### Server
- server/Makefile
- server/models.py

## Folder Structure
You can run this command to get a bird's eye view of the folder structure:

```bash
tree -I node_modules -I uploads -I history -I screenshots
```
