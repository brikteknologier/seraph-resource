var request = require('supertest');
var express = require('express');
var SeraphMock = require('./seraph_mock');
var model = require('seraph-model');
var expose = require('../');
var assert = require('assert');
var async = require('async');

describe('Seraph Model HTTP Methods', function() {
  var mock, beer, user, app;
  beforeEach(function() {
    mock = new SeraphMock();
    beer = model(mock, 'beer');
    beer.fields = ['name', 'fields', 'ibus', 'hops', 'brewery'];
    user = model(mock, 'user');
    app = express();
    app.use('/brews/', expose(beer))
    app.use(expose(user))
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
          .send('"Simcoe, Cascade"')         
          .expect(201)
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
              .expect(200)
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

  it('should be able to update properties', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Linneaus IPA', brewery: 'Monadic Ale', ibus: 65 })
      .end(function(err, res) {
        request(app, err)
          .put('/brews/beer/' + res.body.id + '/ibus')
          .type("json")
          .send(87)         
          .expect(200)
          .expect({ 
            name: 'Linneaus IPA', 
            brewery: 'Monadic Ale', 
            ibus: 87,
            id: 0
          })
          .end(function(err) {
            assert(!err,err);
            request(app, err)
              .get('/brews/beer/' + res.body.id)
              .expect(200)
              .expect({ 
                name: 'Linneaus IPA', 
                brewery: 'Monadic Ale', 
                ibus: 87,
                id: 0
              })
              .end(done)
          })
      })
  });

  it('should be able to delete properties', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Linneaus IPA', brewery: 'Monadic Ale', ibus: 65 })
      .end(function(err, res) {
        request(app, err)
          .del('/brews/beer/' + res.body.id + '/ibus') 
          .expect(200)
          .expect({ 
            name: 'Linneaus IPA', 
            brewery: 'Monadic Ale', 
            id: 0
          })
          .end(function(err) {
            assert(!err,err);
            request(app, err)
              .get('/brews/beer/' + res.body.id)
              .expect(200)
              .expect({ 
                name: 'Linneaus IPA', 
                brewery: 'Monadic Ale',
                id: 0
              })
              .end(done)
          })
      })
  });

  it('should be able to create a relationship', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Pliny the Elder' })
      .end(function(err, res) {
        request(app)
          .post('/brews/beer/' + res.body.id + '/rel/someType/10')
          .send({key: 'value'})
          .expect(200)
          .expect({
            from: 0, to: 10, id: 0, 
            type:'someType',
            properties: { key: 'value' }
          }).end(done);
      });
  })
  it('should be able to create a relationship with no props', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Pliny the Elder' })
      .end(function(err, res) {
        request(app)
          .post('/brews/beer/' + res.body.id + '/rel/someType/10')
          .expect(200)
          .expect({
            from: 0, to: 10, id: 0, 
            type:'someType',
            properties: {}
          }).end(done);
      });
  })

  it('should retrieve a relationship', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Pliny the Elder' })
      .end(function(err, res) {
        request(app)
          .post('/brews/beer/' + res.body.id + '/rel/someType/10')
          .end(function(err, res) {
            request(app)
              .get('/brews/beer/0/rel/someType/out')
              .expect(200)
              .expect([{
                from: 0, to: 10, id: 0, 
                type:'someType',
                properties: {}
              }]).end(done);
          });
      });
  })

  it('should retrieve all relevant relationships', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Pliny the Elder' })
      .end(function(err, res) {
        var r0 = request(app)
          .post('/brews/beer/' + res.body.id + '/rel/someType/10');
        var r1 = request(app)
          .post('/brews/beer/10/rel/someType/0');
        var r2 = request(app)
          .post('/brews/beer/' + res.body.id + '/rel/other/10');
        var r3 = request(app)
          .post('/brews/beer/5/rel/someType/6');
        async.series([
          r0.end.bind(r0),
          r1.end.bind(r1),
          r2.end.bind(r2),
          r3.end.bind(r3)
        ], function(err, res) {
          request(app)
            .get('/brews/beer/0/rel/someType')
            .expect(200)
            .expect([{
              from: 0, to: 10, id: 0, 
              type:'someType',
              properties: {}
            }, {
              from: 10, to: 0, id: 1,
              type: 'someType',
              properties: {}
            }]).end(done);
        })
      });
  })

  it('should retrieve all relevant incoming relationships', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Pliny the Elder' })
      .end(function(err, res) {
        var r0 = request(app)
          .post('/brews/beer/' + res.body.id + '/rel/someType/10');
        var r1 = request(app)
          .post('/brews/beer/10/rel/someType/0');
        var r2 = request(app)
          .post('/brews/beer/' + res.body.id + '/rel/other/10');
        var r3 = request(app)
          .post('/brews/beer/5/rel/someType/6');
        async.series([
          r0.end.bind(r0),
          r1.end.bind(r1),
          r2.end.bind(r2),
          r3.end.bind(r3)
        ], function(err, res) {
          request(app)
            .get('/brews/beer/0/rel/someType/in')
            .expect(200)
            .expect([{
              from: 10, to: 0, id: 1,
              type: 'someType',
              properties: {}
            }]).end(done);
        })
      });
  })

  it('should retrieve all relevant outgoing relationships', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Pliny the Elder' })
      .end(function(err, res) {
        var r0 = request(app)
          .post('/brews/beer/' + res.body.id + '/rel/someType/10');
        var r1 = request(app)
          .post('/brews/beer/10/rel/someType/0');
        var r2 = request(app)
          .post('/brews/beer/' + res.body.id + '/rel/other/10');
        var r3 = request(app)
          .post('/brews/beer/5/rel/someType/6');
        async.series([
          r0.end.bind(r0),
          r1.end.bind(r1),
          r2.end.bind(r2),
          r3.end.bind(r3)
        ], function(err, res) {
          request(app)
            .get('/brews/beer/0/rel/someType/out')
            .expect(200)
            .expect([{
              from: 0, to: 10, id: 0, 
              type:'someType',
              properties: {}
            }]).end(done);
        })
      });
  })

  it('should not call res.end incorrectly', function(done) {
    request(app)
      .get('/user/name')
      .expect(404)
      .end(done);
  });

  it('should allow overloading of the GET point.', function(done) {
    app.get('/user/jellybean', function(req,res) {
      res.send("Jellybean!", 200);
    });
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .end(function(err,res) {
        request(app)
          .get('/user/' + res.body.id)
          .expect(200)
          .expect({ name: 'Jellybean', species: 'Cat', id: res.body.id })
          .end(function() {
            request(app)
              .get('/user/jellybean')
              .expect(200)
              .expect("Jellybean!")
              .end(done)
          })
      });
  })
})
