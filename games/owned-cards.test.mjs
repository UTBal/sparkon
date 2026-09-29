import test from 'node:test';
import assert from 'node:assert/strict';
import {ownedCardFor} from './games/js/owned-cards.mjs';
const cards=Object.freeze([
 Object.freeze({instanceId:'a',conceptId:'gold',edition:'standard'}),
 Object.freeze({instanceId:'b',conceptId:'gold',edition:'premium'}),
 Object.freeze({instanceId:'c',conceptId:'dna',edition:'hero'})
]);
test('screen style cannot turn an unowned card into Premium/Hero',()=>{
 for(const skin of ['original','premium','hero']){
  assert.equal(ownedCardFor(cards,'oxygen').edition,'standard');
  assert.equal(ownedCardFor(cards,'gold').edition,'premium');
  assert.equal(ownedCardFor(cards,'dna').edition,'hero');
 }
});
test('explicit equipped owned instance wins; invented instance does not',()=>{
 assert.equal(ownedCardFor(cards,'gold','a').edition,'standard');
 assert.equal(ownedCardFor(cards,'gold','not-owned').instanceId,'b');
 assert.equal(cards[0].edition,'standard');
});
