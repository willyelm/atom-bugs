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
    Resume: `${d.debugger}resume`,
    Resumed: `${d.debugger}resumed`,
    StepOver: `${d.debugger}stepOver`,
    StepInto: `${d.debugger}stepInto`,
    StepOut: `${d.debugger}stepOut`,
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
