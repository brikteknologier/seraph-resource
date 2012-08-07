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
    beer.fields = ['name', 'fields', 'ibus', 'hops', 'brewery'];
    user = model(mock, 'user');
    app = express();
    app.use(express.bodyParser({strict:false}));
    expose(beer, {root: '/brews/'}).attach(app);
    expose(user).attach(app);
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
              .expect(404)
              .end(done);
          })
      });
  });

  it('should be able to access defined properties', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Linneaus IPA', brewery: 'Monadic Ale', ibus: 65 })
      .end(function(err, res) {
        request(app, err)
          .get('/brews/beer/' + res.body.id + '/brewery')
          .expect(200)
          .expect('"Monadic Ale"')
          .end(done)
      })
  });

  it('should be give 404 for expected but unset props', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Linneaus IPA', brewery: 'Monadic Ale', ibus: 65 })
      .end(function(err, res) {
        request(app, err)
          .get('/brews/beer/' + res.body.id + '/hops')
          .expect(404)
          .end(done)
      })
  });

  it('should be able to create properties', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Linneaus IPA', brewery: 'Monadic Ale', ibus: 65 })
      .end(function(err, res) {
        request(app, err)
          .post('/brews/beer/' + res.body.id + '/hops')
          .type("json")
          .send('Simcoe, Cascade')         
          .expect(200)
          .expect({ 
            name: 'Linneaus IPA', 
            brewery: 'Monadic Ale', 
            ibus: 65,
            hops: "Simcoe, Cascade",
            id: 0
          })
          .end(function(err) {
            assert(!err,err);
            request(app, err)
              .get('/brews/beer/' + res.body.id)
              .expect({ 
                name: 'Linneaus IPA', 
                brewery: 'Monadic Ale', 
                ibus: 65,
                hops: "Simcoe, Cascade" ,
                id: 0
              })
              .end(done)
          })
      })
  });
})
