# Liquid-IoT Device Manager Server

The device manager server of the liquid-IoT project which is developed in Tampere university of Technology.

## Prerequisites

- [Nodejs and NPM](nodejs.org) >= v0.12.0
- [Git](https://git-scm.com/)
- [MongoDB](https://www.mongodb.org/)

## How to run

This project is a nodejs application that uses MongoDB as a database:

1- Clone the project. 'git clone https://github.com/ohylli/liquidiot-manager.git'

2- Go to the project directory you have just cloned. 'cd liquidiot-manager'

3- Install needed dependencies. 'npm install'

4- Optional change the MongoDB url the application connects to. By default it is mongodb://localhost/dms. To change it, set the value of an environment variable called mongourl to your MongoDB URL.

5- Optional change the TCP port the server will listen on by setting the environment variable PORT. By default the server listens on port 3000.

6- Run the project. 'npm start'
