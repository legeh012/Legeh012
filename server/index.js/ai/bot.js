const EventEmitter = require('events');

// Simple mock AI bot adapter. In prod, replace with calls to an LLM provider.
function createPersona(prompt, persona = {}) {
  return { prompt, persona };
}

function generateReply(personaObj, input) {
  // Very simple mock reply that echoes and peppers persona
  const base = `Character(${personaObj.persona.name || 'Anon'}): responding to "${input}"`;
  return `${base}. (${personaObj.persona.style || 'neutral'})`;
}

function streamReply(personaObj, input) {
  const emitter = new EventEmitter();
  // simulate tokenized stream
  const reply = generateReply(personaObj, input);
  const tokens = reply.split(' ');
  let i = 0;
  const t = setInterval(() => {
    if (i >= tokens.length) {
      emitter.emit('end');
      clearInterval(t);
      return;
    }
    emitter.emit('data', tokens[i] + (i < tokens.length - 1 ? ' ' : ''));
    i++;
  }, 60);
  return emitter;
}

module.exports = { createPersona, generateReply, streamReply };