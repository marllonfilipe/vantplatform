export const sdrQuestions={
 stated_need:'Que problema você precisa resolver e qual resultado espera?',
 purchase_intent:'Em qual etapa de avaliação da compra você está?',
 budget_state:'O orçamento já foi definido ou ainda precisa de aprovação?',
 purchase_window:'Quando a decisão de compra deverá ocorrer?',
 stated_objection:'Existe alguma objeção que precise ser tratada?'
};
export function prepareSdr(lead){
 return Object.entries(sdrQuestions)
   .filter(([field])=>lead[field]==null || lead[field]==='' || lead[field]==='unknown' || (field==='budget_state' && lead[field]==='unconfirmed'))
   .map(([field,question])=>({field,question,previous:lead[field]??null}));
}
