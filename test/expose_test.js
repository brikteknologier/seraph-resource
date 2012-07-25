var request = require('supertest');
var express = require('express');
var SeraphMock = require('./seraph_mock');
var model = require('seraph_model');
var expose = require('../');
var assert = require('assert');

describe('Seraph Model HTTP Methods', function() {
  var mock, beer, user, app;
  beforeEach(function() {
    mock = new SeraphMock();
    beer = model(mock, 'beer');
    user = model(mock, 'user');
    app = express();
    app.use(express.bodyParser());
    expose(app, beer, {root: '/brews/'});
    expose(app, user);
  });

  it('should save a model', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .expect('Content-Type', /json/)
      .expect(201)
      .expect({ name: 'Jellybean', species: 'Cat', id: 0 })
      .end(done)
  });

  it('should retrieve a model', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .end(function(err, res) {
        request(app)
          .get('/user/' + res.body.id)
          .expect(200)
          .expect('Content-Type', /json/)
          .expect({ name: 'Jellybean', species: 'Cat', id: 0 })
          .end(done);
      });
  })

  it('should save it as the right type of model', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .end(function() {
        mock.index.read('nodes', 'type', 'user', function(err, contents) {
          assert.ok(contents.length > 0);
          done();
        })
      });
  });

  it('should handle optional root prefixes', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'The Harvest', brewery: 'Bridge Road' })
      .expect('Content-Type', /json/)
      .expect(201)
      .expect({ name: 'The Harvest', brewery: 'Bridge Road', id: 0 })
      .end(done)
  });

  it('should handle updating', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .end(function(err, res) {
        res.body.age = 13;
        request(app, err)
          .put('/user/' + res.body.id)
          .send(res.body)
          .expect(200)
          .expect(res.body)
          .end(function(err) {
            assert.ok(!err, err);
            request(app)
              .get('/user/' + res.body.id)
              .expect(200)
              .expect('Content-Type', /json/)
              .expect({ name: 'Jellybean', species: 'Cat', age: 13, id: 0 })
              .end(done);
          })
      });
  });

  it('should handle updating without url ID', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .end(function(err, res) {
        res.body.age = 13;
        request(app, err)
          .put('/user/')
          .send(res.body)
          .expect(200)
          .expect(res.body)
          .end(function(err) {
            assert.ok(!err, err);
            request(app)
              .get('/user/' + res.body.id)
              .expect(200)
              .expect('Content-Type', /json/)
              .expect({ name: 'Jellybean', species: 'Cat', age: 13, id: 0 })
              .end(done);
          })
      });
  });

  it('should handle updating without object ID', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .end(function(err, res) {
        res.body.age = 13;
        delete res.body.id;
        request(app, err)
          .put('/user/0')
          .send(res.body)
          .expect(200)
          .expect({ name: 'Jellybean', species: 'Cat', age: 13, id: 0 })
          .end(function(err) {
            assert.ok(!err, err);
            request(app)
              .get('/user/0')
              .expect(200)
              .expect('Content-Type', /json/)
              .expect({ name: 'Jellybean', species: 'Cat', age: 13, id: 0 })
              .end(done);
          })
      });
  });

  it('should handle deleting', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .end(function(err, res) {
        request(app, err)
          .del('/user/' + res.body.id)
          .expect(200)
          .end(function(err) {
            assert.ok(!err, err);
            request(app)
              .get('/user/' + res.body.id)
              .expect(500)
              .end(done);
          })
      });
  });
})
