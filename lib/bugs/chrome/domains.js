'use strict'
// Chrome Domains

let d = {
  debugger: 'Debugger.',
  console: 'Console.',
  page: 'Page.'
}

module.exports = {
  Debugger: {
    Enabled: `${d.debugger}enable`,
    Resumed: `${d.debugger}resumed`,
    Paused: `${d.debugger}paused`,
    BreakpointResolved: `${d.debugger}breakpointResolved`,
    ScriptParsed: `${d.debugger}scriptParsed`,
    GetBacktrace: `${d.debugger}getBacktrace`
  },
  Console: {
    Enabled: `${d.console}enable`,
    MessageAdded: `${d.console}messageAdded`
  },
  Page: {
    Navigate: `${d.page}navigate`,
    SetOverlayMessage: `${d.page}setOverlayMessage`
  }
}
