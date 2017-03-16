/* eslint-env jasmine */
/* global atom, waitsForPromise */

describe('Atom Bugs', function () {
  beforeEach(function () {
    return waitsForPromise(function () {
      return atom.packages.activatePackage('atom-bugs')
    })
  })
  it('allows the font size to be set via config', function () {
    // expect(document.documentElement.style.fontSize).toBe('')
    // atom.config.set('atom-bugs-ui.fontSize', '10')
    // expect(document.documentElement.style.fontSize).toBe('10px')
    // atom.config.set('atom-bugs-ui.fontSize', 'Auto')
    // return expect(document.documentElement.style.fontSize).toBe('')
  })
})
