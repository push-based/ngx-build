describe('Ngx Build Demo', () => {
  it('renders the kitchen sink app', () => {
    const jsRequests: string[] = [];

    cy.intercept('GET', '**/*.js', (req) => {
      jsRequests.push(req.url);
      req.continue();
    });

    cy.visit('/');

    cy.get('h1').should('contain', 'Ngx Build Demo');
    cy.wrap(jsRequests).its('length').should('be.lte', 4);
  });
});
