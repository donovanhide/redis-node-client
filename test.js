#!/usr/bin/env node

// Redis client for Node.js -- tests.
// Author: Brian Hammond <brian at fictorial dot com>
// Copyright (C) 2009 Fictorial LLC
// License: MIT

// To test:
// (0) check README.md for the latest status on supported redis versions
// (1) fire up redis-server on 127.0.0.1:6379 (default)
// (2) install node.js
// (3) node test.js

// NOTE: this test suite uses databases 14 and 15 for test purposes! It will
// **clear** these databases at the start of the test runs.  If you want to use
// a different database number, update TEST_DB_NUMBER* below.

//GLOBAL.DEBUG = true;

var TEST_DB_NUMBER = 15,
    TEST_DB_NUMBER_FOR_MOVE = 14;

var sys = require("sys"),
    test = require("mjsunit"),
    redisclient = require("./redisclient");

var pending_callbacks = 0;

function expect_callback() {
  pending_callbacks++;
  sys.puts("pending: " + pending_callbacks);
}

function was_called_back() {
  pending_callbacks--;
  sys.puts("pending: " + pending_callbacks);
}

function expect_true_reply(error, reply) {
  // Redis' protocol returns +OK for some operations.
  // The client converts this into a ECMAScript boolean type with value true.
  
  expect_callback();
  if(!error) {
    test.assertEquals(typeof(reply), 'boolean');
    test.assertTrue(reply);
    was_called_back();
  }
  else {
    test.assertTrue(error);
  }
}

function expectFalse(error, reply) {
  expect_callback();
  if(!error) {
    test.assertEquals(typeof(reply), 'boolean');
    test.assertFalse(reply);
    was_called_back();
  }
  else {
    test.assertTrue(error);
  }
}

function expect_numeric_reply(expected_value) {
  expect_callback();
  return function( error, reply ) {
    if(!error) {
      test.assertEquals(typeof(reply), 'number');
      test.assertEquals(expected_value, reply);
      was_called_back();
    }
    else {
      test.assertTrue(error);
    }
  }
}

function expect_zero_as_reply(err, reply) {
  return expect_numeric_reply(0)(err, reply);
}

function expect_one_as_reply(err, reply) {
  return expect_numeric_reply(1)(err, reply);
}

function test_auth() {
  // You need to configure redis to enable auth.  
  // This unit test suite assumes the auth feature is off/disabled.
  // Auth *would be* the first command required after connecting.
}

// Test functions start with 'test_' and are listed here in executed order by
// convention.  NOTE: the actual list of tests is *manually* specified at the
// bottom of this file.

function test_select() {
  client.select(TEST_DB_NUMBER_FOR_MOVE, expect_true_reply);
  client.flushdb(expect_true_reply);
  client.select(TEST_DB_NUMBER, expect_true_reply);
  client.flushdb(expect_true_reply);
}

function test_flushdb() {
  // no-op; tested in test_select
}

function test_set() {
  client.set('foo', 'bar',expect_true_reply)
  client.set('baz', 'buz',expect_true_reply)
}

function test_setnx() {
  client.setnx('foo', 'quux', expect_zero_as_reply);  // fails when already set
  client.setnx('boo', 'apple', expect_one_as_reply);  // no such key already so OK
}

function test_get() {
  expect_callback();
  client.get('foo', function (err,value) { 
    test.assertEquals(value, 'bar');
    was_called_back(); 
  });

  expect_callback();
  client.get('boo', function (err,value) { 
    test.assertEquals(value, 'apple'); 
    was_called_back();
  });
}

function test_mget() {
  expect_callback();
  client.mget('foo', 'boo', function (err,values) { 
    test.assertEquals('bar', values[0]);
    test.assertEquals('apple', values[1]);
    was_called_back();
  });
}

function test_getset() {
  expect_callback();
  client.getset('foo', 'fuzz', function (err, previous_value) {
    test.assertEquals('bar', previous_value);
    was_called_back();
  });
}

function test_set_and_get_multibyte() {
  var test_value = unescape('%F6');
  client.set('unicode', test_value,expect_true_reply)
  expect_callback();
  client.get('unicode', function (err,value) { 
    test.assertEquals(test_value, value);
    was_called_back(); 
  });
}

function test_info() {
  expect_callback();
  client.info( function (err,info) {
    test.assertInstanceof(info, Object);
    test.assertTrue(info.hasOwnProperty('redis_version'));
    test.assertTrue(info.hasOwnProperty('connected_clients'));
    test.assertTrue(info.hasOwnProperty('uptime_in_seconds'));
    test.assertEquals(typeof(info.uptime_in_seconds), 'number');
    test.assertEquals(typeof(info.connected_clients), 'number');
    was_called_back();
  });
}

function test_incr() {
  client.incr('counter',expect_numeric_reply(1))
  client.incr('counter',expect_numeric_reply(2))
}

function test_incrby() {
  client.incrby('counter', '2',expect_numeric_reply(4))
  client.incrby('counter', '-1',expect_numeric_reply(3))
}

function test_decr() {
  client.decr('counter',expect_numeric_reply(2))
  client.decr('counter',expect_numeric_reply(1))
}

function test_decrby() {
  client.decrby('counter', '1',expect_numeric_reply(0))
  client.decrby('counter', '2',expect_numeric_reply(-2))
  client.decrby('counter', '-3',expect_numeric_reply(1))
}

function test_exists() {
  client.exists('counter',expect_one_as_reply)
  client.exists('counter:asdfasdf',expect_zero_as_reply)
}

function test_del() {
  client.del('counter',expect_one_as_reply)
  client.exists('counter',expect_zero_as_reply)
}

function test_keys() {
  client.set('foo2', 'some value',expect_true_reply)

  expect_callback();
  client.keys('foo*', function (err,keys) {
    test.assertEquals(keys.length, 2);
    test.assertEquals(['foo','foo2'], keys.sort());
    was_called_back();
  });

  // At this point we have foo, baz, boo, and foo2, unicode
  expect_callback();
  client.keys('*', function (err,keys) {
    test.assertEquals(keys.length, 5);
    test.assertEquals(['baz','boo','foo','foo2','unicode'], keys.sort());
    was_called_back();
  });

  // foo and boo
  expect_callback();
  client.keys('?oo', function (err,keys) {
    test.assertEquals(keys.length, 2);
    test.assertEquals(['boo','foo'], keys.sort());
    was_called_back();
  });
}

function test_randomkey() {
  // At this point we have foo, baz, boo, foo2, unicode.
  expect_callback();
  client.randomkey(function (err,someKey) {
    test.assertTrue(/^(foo|foo2|boo|baz|unicode)$/.test(someKey));
    was_called_back();
  });
}

function test_rename() {
  client.rename('foo2', 'zoo',expect_true_reply) 
  client.exists('foo2',expect_zero_as_reply)
  client.exists('zoo',expect_one_as_reply)
}

function test_renamenx() {
  client.renamenx('zoo', 'boo',expect_zero_as_reply)  // boo already exists
  client.exists('zoo',expect_one_as_reply)            // was not renamed
  client.exists('boo',expect_one_as_reply)            // was not touched
  client.renamenx('zoo', 'too',expect_one_as_reply)   // too did not exist... OK
  client.exists('zoo',expect_zero_as_reply)           // was renamed
  client.exists('too',expect_one_as_reply)            // was created
}

function test_dbsize() {
  expect_callback();
  client.dbsize(function (err,value) { 
    test.assertEquals(5, value); 
    was_called_back();
  });
}

function test_expire() {
  // set 'too' to expire in 2 seconds
  client.expire('too', 2,expect_one_as_reply)

  // subsequent expirations cannot be set.
  client.expire('too', 2,expect_zero_as_reply)

  setTimeout(function () {
    sys.puts("\nWaiting a few seconds for key expirations...\n");
  }, 1000);

  // check that in 4 seconds that it's gone 
  setTimeout(function () { 
    client.exists('too', function(err, reply) {
      expect_zero_as_reply(err, reply);
      if (pending_callbacks === 0) {
        sys.puts("\n\nall tests have completed");
        process.exit(0);
      }
    });
  }, 4000);
}

function test_ttl() {
  // foo is not set to expire
  expect_callback();
  client.ttl('foo', function (err,value) { 
    test.assertEquals(-1, value); 
    was_called_back(); 
  });

  // 'too' *is* set to expire
  expect_callback();
  client.ttl('too', function (err,value) { 
    test.assertTrue(value > 0);
    was_called_back();
  });
}

function test_rpush() {
  client.exists('list0',expect_zero_as_reply)
  client.rpush('list0', 'list0value0',expect_true_reply)
  client.exists('list0',expect_one_as_reply)
}

function test_lpush() {
  client.exists('list1',expect_zero_as_reply)
  client.lpush('list1', 'list1value0',expect_true_reply)
  client.exists('list1',expect_one_as_reply)
}

function test_llen() {
  client.llen('list0',expect_one_as_reply)
  client.rpush('list0', 'list0value1',expect_true_reply)

  expect_callback();
  client.llen('list0', function (err,len) { 
    test.assertEquals(2, len);
    was_called_back();
  });
}

function test_lrange() {
  expect_callback();
  client.lrange('list0', 0, -1, function (err,values) {
    test.assertEquals(2, values.length);
    test.assertEquals('list0value0', values[0]);
    test.assertEquals('list0value1', values[1]);
    was_called_back();
  });

  expect_callback();
  client.lrange('list0', 0, 0, function (err,values) {
    test.assertEquals(1, values.length);
    test.assertEquals('list0value0', values[0]);
    was_called_back();
  });

  expect_callback();
  client.lrange('list0', -1, -1, function (err,values) {
    test.assertEquals(1, values.length);
    test.assertEquals('list0value1', values[0]);
    was_called_back();
  });
}

function test_ltrim() {
  // trim list so it just contains the first 2 elements

  client.rpush('list0', 'list0value2',expect_true_reply)

  expect_callback();
  client.llen('list0', function (err,len) { 
    test.assertEquals(3, len);
    was_called_back();
  });

  client.ltrim('list0', 0, 1,expect_true_reply)

  expect_callback();
  client.llen('list0', function (err,len) { 
    test.assertEquals(2, len);
    was_called_back();
  });

  expect_callback();
  client.lrange('list0', 0, -1, function (err,values) {
    test.assertEquals(2, values.length);
    test.assertEquals('list0value0', values[0]);
    test.assertEquals('list0value1', values[1]);
    was_called_back();
  });
}

function test_lindex() {
  expect_callback();
  client.lindex('list0', 0, function (err,value) { 
    test.assertEquals('list0value0', value);
    was_called_back();
  });

  expect_callback();
  client.lindex('list0', 1, function (err,value) { 
    test.assertEquals('list0value1', value);
    was_called_back();
  });

  // out of range => null 
  expect_callback();
  client.lindex('list0', 2, function (err,value) { 
    test.assertEquals(null, value);
    was_called_back();
  });
}

function test_lset() {
  client.lset('list0', 0, 'LIST0VALUE0',expect_true_reply)  

  expect_callback();
  client.lrange('list0', 0, 0, function (err,values) {
    test.assertEquals(1, values.length);
    test.assertEquals('LIST0VALUE0', values[0]);
    was_called_back();
  });

  // FYI list0 is [ LIST0VALUE0, list0value1 ] at this point
}

function test_lrem() {
  client.lpush('list0', 'ABC',expect_true_reply) 
  client.lpush('list0', 'DEF',expect_true_reply) 
  client.lpush('list0', 'ABC',expect_true_reply) 

  // FYI list0 is [ ABC, DEF, ABC, LIST0VALUE0, list0value1 ] at this point

  client.lrem('list0', 1, 'ABC',expect_one_as_reply)
}

function test_lpop() {
  // FYI list0 is [ DEF, ABC, LIST0VALUE0, list0value1 ] at this point

  expect_callback();
  client.lpop('list0', function (err,value) { 
    test.assertEquals('DEF', value);
    was_called_back();
  });

  expect_callback();
  client.lpop('list0', function (err,value) { 
    test.assertEquals('ABC', value);
    was_called_back();
  });
}

function test_rpop() {
  // FYI list0 is [ LIST0VALUE0, list0value1 ] at this point
  
  expect_callback();
  client.rpop('list0', function (err,value) { 
    test.assertEquals('list0value1', value);
    was_called_back();
  });

  expect_callback();
  client.rpop('list0', function (err,value) { 
    test.assertEquals('LIST0VALUE0', value);
    was_called_back();
  });

  // list0 is now empty

  expect_callback();
  client.llen('list0', function (err,len) { 
    test.assertEquals(0, len);
    was_called_back();
  });
}

function test_rpoplpush() {
  client.exists('rpoplpush_source',expect_zero_as_reply)
  client.exists('rpoplpush_target',expect_zero_as_reply)

  client.rpush('rpoplpush_source', 'ABC',expect_true_reply) 
  client.rpush('rpoplpush_source', 'DEF',expect_true_reply) 

  // rpoplpush_source = [ 'ABC', 'DEF' ]
  // rpoplpush_target = [ ]

  expect_callback();
  client.rpoplpush('rpoplpush_source', 'rpoplpush_target', function (err,value) { 
    was_called_back();
    test.assertEquals('DEF', value);

    // rpoplpush_source = [ 'ABC' ]

    expect_callback();
    client.lrange('rpoplpush_source', 0, -1, function (err,values) {
      test.assertEquals(['ABC'], values);
      was_called_back();
    });

    // rpoplpush_target = [ 'DEF' ]

    expect_callback();
    client.lrange('rpoplpush_target', 0, -1, function (err,values) {
      test.assertEquals(['DEF'], values);
      was_called_back();
    });
  });
}

function test_sadd() {
  // create set0
  client.sadd('set0', 'member0',expect_one_as_reply)  

  // fails since it's already a member
  client.sadd('set0', 'member0',expect_zero_as_reply)  
}

function test_sismember() {
  client.sismember('set0', 'member0',expect_one_as_reply)  
  client.sismember('set0', 'member1',expect_zero_as_reply)  
}

function test_scard() {
  client.scard('set0',expect_one_as_reply) 
  client.sadd('set0', 'member1',expect_one_as_reply)

  expect_callback();  
  client.scard('set0', function (err,cardinality) { 
    test.assertEquals(2, cardinality);
    was_called_back();
  }); 
}

function test_srem() {
  client.srem('set0', 'foobar',expect_zero_as_reply) 
  client.srem('set0', 'member1',expect_one_as_reply) 
  client.scard('set0',expect_one_as_reply)             // just member0 again
}

function test_spop() {
  client.sadd('zzz', 'member0',expect_one_as_reply)
  client.scard('zzz',expect_one_as_reply)

  expect_callback();  
  client.spop('zzz', function (err,value) {    
    was_called_back();
    test.assertEquals(value, 'member0');
    client.scard('zzz',expect_zero_as_reply)
  });
}

function test_sdiff() {
  client.sadd('bsh', 'x',expect_one_as_reply)
  client.sadd('bsh', 'a',expect_one_as_reply)
  client.sadd('bsh', 'b',expect_one_as_reply)
  client.sadd('bsh', 'c',expect_one_as_reply)
  client.sadd('hah', 'c',expect_one_as_reply)
  client.sadd('hac', 'a',expect_one_as_reply)
  client.sadd('hac', 'd',expect_one_as_reply)
  expect_callback();  
  client.sdiff('bsh', 'hah', 'hac', function (err,values) {    
    was_called_back();
    values.sort();
    test.assertEquals(values.length, 2);
    test.assertEquals(values[0], 'b');
    test.assertEquals(values[1], 'x');
  });
}

function test_sdiffstore() {
  client.sadd('bsh2', 'x',expect_one_as_reply)  
  client.sadd('bsh2', 'a',expect_one_as_reply)
  client.sadd('bsh2', 'b',expect_one_as_reply)
  client.sadd('bsh2', 'c',expect_one_as_reply)
  client.sadd('hah2', 'c',expect_one_as_reply)
  client.sadd('hac2', 'a',expect_one_as_reply)
  client.sadd('hac2', 'd',expect_one_as_reply)

  // NB: returns the number of elements in the dstkey (here crunk2)

  client.sdiffstore('crunk2', 'bsh2', 'hah2', 'hac2',expect_numeric_reply(2))
  expect_callback();
  client.smembers('crunk2', function (err,members) {     
    was_called_back();
    members.sort();
    test.assertEquals(members.length, 2);
    test.assertEquals(members[0], 'b');
    test.assertEquals(members[1], 'x');
  });
}

function test_smembers() {
  expect_callback();
  client.smembers('set0', function (err,members) { 
    test.assertEquals(1, members.length);
    test.assertEquals('member0', members[0]);
    was_called_back();
  });

  client.sadd('set0', 'member1',expect_one_as_reply)  

  expect_callback();
  client.smembers('set0', function (err,members) { 
    test.assertEquals(2, members.length);
    test.assertEquals(['member0','member1'], members.sort());
    was_called_back();
  });

  // doesn't exist => null

  expect_callback();
  client.smembers('set1', function (err,members) { 
    test.assertEquals(null, members);
    was_called_back();
  });
}

function test_smove() {
  client.smove('set0', 'set1', 'member1',expect_one_as_reply)
  client.sismember('set0', 'member1',expect_zero_as_reply)  
  client.sismember('set1', 'member1',expect_one_as_reply)  

  // member is now moved so => 0
  client.smove('set0', 'set1', 'member1',expect_zero_as_reply)
}

function test_sinter() {
  client.sadd('sa', 'a',expect_one_as_reply)
  client.sadd('sa', 'b',expect_one_as_reply)
  client.sadd('sa', 'c',expect_one_as_reply)
  
  client.sadd('sb', 'b',expect_one_as_reply)
  client.sadd('sb', 'c',expect_one_as_reply)
  client.sadd('sb', 'd',expect_one_as_reply)
  
  client.sadd('sc', 'c',expect_one_as_reply)
  client.sadd('sc', 'd',expect_one_as_reply)
  client.sadd('sc', 'e',expect_one_as_reply)

  expect_callback();
  client.sinter('sa', 'sb', function (err,intersection) {
    test.assertEquals(2, intersection.length);
    test.assertEquals(['b','c'], intersection.sort());
    was_called_back();
  });

  expect_callback();
  client.sinter('sb', 'sc', function (err,intersection) {
    test.assertEquals(2, intersection.length);
    test.assertEquals(['c','d'], intersection.sort());
    was_called_back();
  });

  expect_callback();
  client.sinter('sa', 'sc', function (err,intersection) {
    test.assertEquals(1, intersection.length);
    test.assertEquals('c', intersection[0]);
    was_called_back();
  });

  // 3-way

  expect_callback();
  client.sinter('sa', 'sb', 'sc', function (err,intersection) {
    test.assertEquals(1, intersection.length);
    test.assertEquals('c', intersection[0]);
    was_called_back();
  });
}

function test_sinterstore() {
  client.sinterstore('inter-dst', 'sa', 'sb', 'sc',expect_one_as_reply)

  expect_callback();
  client.smembers('inter-dst', function (err,members) { 
    test.assertEquals(1, members.length);
    test.assertEquals('c', members[0]);
    was_called_back();
  });
}

function test_sunion() {
  expect_callback();
  client.sunion('sa', 'sb', 'sc', function (err,union) {
    test.assertEquals(['a','b','c','d','e'], union.sort());
    was_called_back();
  });
}

function test_sunionstore() {
  expect_callback();
  client.sunionstore('union-dst', 'sa', 'sb', 'sc', function (err,cardinality) { 
    test.assertEquals(5, cardinality);
    was_called_back();
  });
  expect_callback();
  client.smembers('union-dst', function (err,members) { 
    test.assertEquals(5, members.length);
    test.assertEquals(['a','b','c','d','e'], members.sort());
    was_called_back();
  });
}

function test_type() {
  expect_callback();
  client.type('union-dst', function (err,type) { 
    test.assertEquals('set', type);
    was_called_back();
  });
  expect_callback();
  client.type('list0', function (err,type) { 
    test.assertEquals('list', type);
    was_called_back();
  });
  expect_callback();
  client.type('foo', function (err,type) { 
    test.assertEquals('string', type);
    was_called_back();
  });
  expect_callback();
  client.type('xxx', function (err,type) { 
    test.assertEquals('none', type);
    was_called_back();
  });
}

function test_move() {
  client.move('list0', TEST_DB_NUMBER_FOR_MOVE,expect_one_as_reply)
  client.select(TEST_DB_NUMBER_FOR_MOVE,expect_true_reply)
  client.exists('list0',expect_one_as_reply)
  client.select(TEST_DB_NUMBER,expect_true_reply)
  client.exists('list0',expect_zero_as_reply)
}

// TODO sort with STORE option.

// Sort is a beast.
//
// $ redis-cli lrange x 0 -1
// 1. 3
// 2. 9
// 3. 2
// 4. 4
//
// $ redis-cli mget w_3 w_9 w_2 w_4
// 1. 4
// 2. 5
// 3. 12
// 4. 6
//
// $ redis-cli sort x by w_*
// 1. 3
// 2. 9
// 3. 4
// 4. 2
//
// When using 'by w_*' value x[i]'s effective value is w_{x[i]}.
//
// sort [ w_3, w_9, w_2, w_4 ] = sort [ 4, 5, 12, 6 ] 
//                             = [ 4, 5, 6, 12 ] 
//                             = [ w_3, w_9, w_4, w_2 ]
//
// Thus, sorting x 'by w_*' results in [ 3, 9, 4, 2 ]
//
// Once sorted redis can fetch entries at the keys indicated by the 'get' 
// pattern.  If we specify 'get o_*', redis would fetch 
// [ o_3, o_9, o_4, o_2 ] since our sorted list was [ 3, 9, 4, 2 ].
//
// $ redis-cli mget o_2 o_3 o_4 o_9
// 1. buz
// 2. foo
// 3. baz
// 4. bar
//
// $ redis-cli sort x by w_* get o_*
// 1. foo
// 2. bar
// 3. baz
// 4. buz
//
// One can specify multiple get patterns and the keys for each get pattern 
// are interlaced in the results.
//
// $ redis-cli mget p_2 p_3 p_4 p_9
// 1. qux
// 2. bux
// 3. lux
// 4. tux
//
// $ redis-cli sort x by w_* get o_* get p_*
// 1. foo
// 2. bux
// 3. bar
// 4. tux
// 5. baz
// 6. lux
// 7. buz
// 8. qux
//
// Phew! Now, let's test all that.

function test_sort() {
  client.del('x');  // just to be safe
  client.del('y');  // just to be safe
  
  client.rpush('y', 'd',expect_true_reply)
  client.rpush('y', 'b',expect_true_reply)
  client.rpush('y', 'a',expect_true_reply)
  client.rpush('y', 'c',expect_true_reply)

  client.rpush('x', '3',expect_true_reply)
  client.rpush('x', '9',expect_true_reply)
  client.rpush('x', '2',expect_true_reply)
  client.rpush('x', '4',expect_true_reply)

  client.set('w_3', '4',expect_true_reply)
  client.set('w_9', '5',expect_true_reply)
  client.set('w_2', '12',expect_true_reply)
  client.set('w_4', '6',expect_true_reply)
  
  client.set('o_2', 'buz',expect_true_reply)
  client.set('o_3', 'foo',expect_true_reply)
  client.set('o_4', 'baz',expect_true_reply)
  client.set('o_9', 'bar',expect_true_reply)
  
  client.set('p_2', 'qux',expect_true_reply)
  client.set('p_3', 'bux',expect_true_reply)
  client.set('p_4', 'lux',expect_true_reply)
  client.set('p_9', 'tux',expect_true_reply)

  // Now the data has been setup, we can test.

  // But first, test basic sorting.

  // y = [ d b a c ]
  // sort y ascending = [ a b c d ]
  // sort y descending = [ d c b a ]

  expect_callback();
  var opts = { lexicographically:true, ascending:true };
  client.sort('y', opts, function (err,sorted) { 
    test.assertEquals(['a','b','c','d'], sorted);
    was_called_back();
  });

  expect_callback();
  opts = { lexicographically:true, ascending:false };
  client.sort('y', opts, function (err,sorted) {
    test.assertEquals(['d','c','b','a'], sorted);
    was_called_back();
  });

  // Now try sorting numbers in a list.
  // x = [ 3, 9, 2, 4 ]

  expect_callback();
  opts = { ascending:true };
  client.sort('x', opts, function (err,sorted) {
    test.assertEquals([2,3,4,9], sorted);
    was_called_back();
  });

  expect_callback();
  opts = { ascending:false };
  client.sort('x', opts, function (err,sorted) {
    test.assertEquals([9,4,3,2], sorted);
    was_called_back();
  });

  // Try sorting with a 'by' pattern.
  
  expect_callback();
  opts = { ascending:true, by_pattern:'w_*' };
  client.sort('x', opts, function (err,sorted) {
    test.assertEquals([3,9,4,2], sorted);
    was_called_back();
  });

  // Try sorting with a 'by' pattern and 1 'get' pattern.

  expect_callback();
  opts = { ascending:true, by_pattern:'w_*', get_patterns:['o_*'] };
  client.sort('x', opts, function (err,sorted) {
    test.assertEquals(['foo','bar','baz','buz'], sorted);
    was_called_back();
  });

  // Try sorting with a 'by' pattern and 2 'get' patterns.

  expect_callback();
  opts = { ascending:true, by_pattern:'w_*', get_patterns:['o_*', 'p_*'] };
  client.sort('x', opts, function (err,sorted) {
    test.assertEquals(['foo','bux','bar','tux','baz','lux','buz','qux'], sorted);
    was_called_back();
  });

  // Try sorting with a 'by' pattern and 2 'get' patterns.
  // Instead of getting back the sorted set/list, store the values to a list.
  // Then check that the values are there in the expected order.

  expect_callback();
  opts = { ascending:true, by_pattern:'w_*', 
           get_patterns:['o_*', 'p_*'], store_key:'bacon' };
  client.sort('x', opts, function (err) {
    was_called_back();
    expect_callback();
    client.lrange('bacon', 0, -1, function (err,values) {
      test.assertEquals(['foo','bux','bar','tux','baz','lux','buz','qux'], values);
      was_called_back();
    });
  });
}

function test_save() {
  client.save(expect_true_reply)
}

function test_bgsave() {
//  client.bgsave(,expect_true_reply)
}

function test_lastsave() {
  expect_callback();
  client.lastsave( function (err,value) { 
    test.assertEquals(typeof(value), 'number');
    test.assertTrue(value > 0);
    was_called_back();
  });
}

function test_flushall() {
  // skipped
}

function test_shutdown() {
  // skipped
}

function test_set_number() {
  client.set('ggg', '123',expect_true_reply)
  client.set('ggg', 123,expect_true_reply)
}

function test_mset() {
  // set a=b, c=d, e=f
  client.mset('a','b','c','d','e',100,expect_true_reply)
}

function test_msetnx() {
  // should fail since key 'a' as we already set it
  client.msetnx('g', 'h', 'a', 'i',expect_zero_as_reply)
  // should pass as key 'g' was NOT set in prev. command
  // since it failed due to key 'a' already existing.
  client.msetnx('g', 'h', 'i', 'j',expect_one_as_reply)
}

function test_zadd() {
  client.zadd('z0',100,'m0',expect_one_as_reply)
  // Already added m0; just update the score to 50:
  client.zadd('z0',50,'m0',expect_zero_as_reply)
}

function test_zrem() {
  client.zrem('z0','m0',expect_one_as_reply)
  client.zrem('z0','m0',expect_zero_as_reply)
}

function test_zcard() {
  client.zcard('zzzzzz',expect_zero_as_reply) // doesn't exist.
  client.zadd('z0',100,'m0',expect_one_as_reply)
  client.zcard('z0',expect_numeric_reply(1))
  client.zadd('z0',200,'m1',expect_one_as_reply)
  client.zcard('z0',expect_numeric_reply(2))
}

function test_zscore() {
  client.zscore('z0','m0',expect_numeric_reply(100))
  client.zscore('z0','m1',expect_numeric_reply(200))
  expect_callback();
  client.zscore('z0','zzzzzzz', function (err,score) { 
    test.assertTrue(isNaN(score));
    was_called_back();
  });
}

function test_zrange() {
  client.zadd('z0',300,'m2',expect_one_as_reply)
  expect_callback();
  client.zrange('z0',0,1000, function (err,members) { 
    test.assertEquals(3, members.length);
    test.assertEquals('m0', members[0]);
    test.assertEquals('m1', members[1]);
    test.assertEquals('m2', members[2]);
    was_called_back();
  });
  expect_callback();
  client.zrange('z0',-1,-1, function (err,members) { 
    test.assertEquals(1, members.length);
    test.assertEquals('m2', members[0]);
    was_called_back();
  });
  expect_callback();
  client.zrange('z0',-2,-1, function (err,members) { 
    test.assertEquals(2, members.length);
    test.assertEquals('m1', members[0]);
    test.assertEquals('m2', members[1]);
    was_called_back();
  });
}

function test_zrevrange() {
  expect_callback();
  client.zrevrange('z0',0,1000, function (err,members) { 
    test.assertEquals(3, members.length);
    test.assertEquals('m2', members[0]);
    test.assertEquals('m1', members[1]);
    test.assertEquals('m0', members[2]);
    was_called_back();
  });
}

function test_zrangebyscore() {
  expect_callback();
  client.zrangebyscore('z0',200,300, function (err,members) {
    test.assertEquals(2, members.length);
    test.assertEquals('m1', members[0]);
    test.assertEquals('m2', members[1]);
    was_called_back();
  });
  expect_callback();
  client.zrangebyscore('z0',100,1000, function (err,members) {
    test.assertEquals(3, members.length);
    test.assertEquals('m0', members[0]);
    test.assertEquals('m1', members[1]);
    test.assertEquals('m2', members[2]);
    was_called_back();
  });
  expect_callback();
  client.zrangebyscore('z0',10000,100000, function (err,members) {
    test.assertEquals(0, members.length);
    was_called_back();
  });
}

// First, let's make sure the reply parsers are working.

function test_bulk_reply() {
  var a = "$6\r\nFOOBAR\r\n";
  var b = "$-1\r\n";
  var c = "$-1\r";   // NB: partial command, missing \n

  var result = client.handle_bulk_reply(0, a);
  test.assertEquals(2, result.length);
  test.assertEquals("FOOBAR", result[0]);
  test.assertEquals(a.length, result[1]);  // next reply is after this one.

  result = client.handle_bulk_reply(0, b);
  test.assertEquals(2, result.length);
  test.assertEquals(null, result[0]);
  test.assertEquals(b.length, result[1]);  // next reply is after this one.

  result = client.handle_bulk_reply(0, c);
  test.assertEquals(null, result);
}

function test_multi_bulk_reply() {
  var a = "*4\r\n$3\r\nFOO\r\n$3\r\nBAR\r\n$5\r\nHELLO\r\n$5\r\nWORLD\r\n";
  var b = "$-1\r\n";
  var c = "*3\r\n$3\r\nFOO\r\n$-1\r\n$4\r\nBARZ\r\n";

  var result = client.handle_multi_bulk_reply(a);
  test.assertEquals(2, result.length);
  var values = result[0];
  test.assertEquals(4, values.length);
  test.assertEquals('FOO', values[0]);
  test.assertEquals('BAR', values[1]);
  test.assertEquals('HELLO', values[2]);
  test.assertEquals('WORLD', values[3]);
  test.assertEquals(a.length, result[1]);

  result = client.handle_multi_bulk_reply(b);
  test.assertEquals(2, result.length);
  test.assertEquals(null, result[0]);
  test.assertEquals(b.length, result[1]);

  result = client.handle_multi_bulk_reply(c);
  test.assertEquals(2, result.length);
  values = result[0];
  test.assertEquals(3, values.length);
  test.assertEquals('FOO', values[0]);
  test.assertEquals(null, values[1]);
  test.assertEquals('BARZ', values[2]);
  test.assertEquals(c.length, result[1]);
}

function test_single_line_reply() {
  var a = "+OK\r\n";
  var b = "+WHATEVER\r\n";

  var result = client.handle_single_line_reply(a);
  test.assertEquals(2, result.length);
  test.assertEquals(true, result[0]);
  test.assertEquals(a.length, result[1]);

  result = client.handle_single_line_reply(b);
  test.assertEquals(2, result.length);
  test.assertEquals("WHATEVER", result[0]);
  test.assertEquals(b.length, result[1]);
}

function test_integer_reply() {
  var a = ":-1\r\n";
  var b = ":1000\r\n";

  var result = client.handle_integer_reply(a);
  test.assertEquals(2, result.length);
  test.assertEquals(-1, result[0]);
  test.assertEquals(a.length, result[1]);

  result = client.handle_integer_reply(b);
  test.assertEquals(2, result.length);
  test.assertEquals(1000, result[0]);
  test.assertEquals(b.length, result[1]);
}

function test_error_reply() {
  var a = "-ERR solar flare\r\n";
  var b = "-hiccup\r\n";

  var result = client.handle_error_reply(a);
  test.assertEquals(2, result.length);
  test.assertEquals("solar flare", result[0]);
  test.assertEquals(a.length, result[1]);

  result = client.handle_error_reply(b);
  test.assertEquals(2, result.length);
  test.assertEquals("hiccup", result[0]);
  test.assertEquals(b.length, result[1]);
}

// This is an array of test functions.  Order is important as we don't have
// fixtures.  We test 'set' before 'get' for instance.

var client_tests = [ 
  test_auth, test_select, test_flushdb, test_set, test_setnx,
  test_get, test_mget, test_getset, test_set_and_get_multibyte, test_info, 
  test_incr, test_incrby, test_decr,
  test_decrby, test_exists, test_del, test_keys, test_randomkey, test_rename,
  test_renamenx, test_dbsize, test_expire, test_ttl, test_rpush, test_lpush,
  test_llen, test_lrange, test_ltrim, test_lindex, test_lset, test_lrem,
  test_lpop, test_rpop, test_rpoplpush, test_sadd, test_sismember, test_scard, test_srem,
  test_smembers, test_smove, test_sinter, test_sinterstore, test_sunion,
  test_spop, test_sdiff, test_sdiffstore,
  test_sunionstore, test_type, test_move, 
  test_sort, 
  test_mset, test_msetnx,
  test_zadd, test_zrem, test_zcard, test_zscore, test_zrange, test_zrevrange,
  test_zrangebyscore,
  test_save, test_bgsave, 
  test_lastsave, test_flushall, test_shutdown, test_set_number,
];

function run_all_tests() {
  test_bulk_reply();
  test_multi_bulk_reply();
  test_single_line_reply();
  test_integer_reply();
  test_error_reply();

  sys.debug("reply parsers work");

  client_tests.forEach(function (t) { t() });
  sys.puts('**********\n\nall client tests have been submitted\n\n**********');
}

var connection_failed = false;
var client = new redisclient.Client();

client.addListener("close", function (in_error) {
  connection_failed = in_error;
  if (in_error)
    throw new Error("Connection to Redis failed. Not attempting reconnection.");
});

client.connect(run_all_tests);

process.addListener("uncaughtException", function (e) {
  sys.puts(e);
  process.exit(1);
});

process.addListener("exit", function (code) {
  if (!connection_failed)
    test.assertEquals(0, pending_callbacks);
});

