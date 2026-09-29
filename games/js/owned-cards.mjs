/** Rendering only. Never mutates an instance, unlock, balance or collection. */
export function ownedCardFor(cards,conceptId,selectedInstanceId){
 const matches=cards.filter(c=>c.conceptId===conceptId);
 const selected=matches.find(c=>c.instanceId===selectedInstanceId);
 // Consistent display preference when several copies exist; an equipped-instance UI can override.
 return selected||matches.find(c=>c.edition==='hero')||matches.find(c=>c.edition==='premium')||matches[0]||{conceptId,edition:'standard'};
}
