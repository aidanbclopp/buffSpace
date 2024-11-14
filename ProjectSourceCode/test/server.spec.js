// ********************** Initialize server **********************************
const server = require('../src/index'); //TODO: Make sure the path to your index.js is correctly added
// ********************** Import Libraries ***********************************
const chai = require('chai'); // Chai HTTP provides an interface for live integration testing of the API's.
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const {assert, expect} = chai;
// ********************** DEFAULT WELCOME TESTCASE ****************************
describe('Server!', () => {
  // Sample test case given to test / endpoint.
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });
});
// *********************** TODO: WRITE 2 UNIT TESTCASES **************************
describe('Testing Login API', () => {
  it('positive : /login', done => {
    // Test for successful login with valid credentials
    chai
      .request(server)
      .post('/login')
      .send({
        username: 'orange',  // Replace with the correct test username
        password: 'abcdefg'  // Replace with the correct password
      })
      .end((err, res) => {
        expect(res).to.have.status(200);  // Check if status code is 200 (OK)
        expect(res.body.status).to.equal('success');  // Ensure the response status is success
        expect(res.body.message).to.equal('Login successful.');  // Check for the correct success message
        expect(res.body.session).to.not.be.null;  // Ensure a session object is returned (indicating login success)
        done();
      });
  });
});
it('negative : /login with invalid credentials', done => {
  // Test for failed login with invalid credentials
  chai
    .request(server)
    .post('/login')
    .send({
      username: 'orange',  // correct username
      password: '12345'  // Incorrect password
    })
    .end((err, res) => {
      expect(res).to.have.status(401);  // Check if status code is 401 (Unauthorized)
      expect(res.body.status).to.equal('failure');  // Ensure the response status is failure
      expect(res.body.message).to.equal('Invalid username or password.');  // Check for the correct failure message
      done();
    });
});
// ********************************************************************************