if (process.env.DISCORD_BRIDGE_SMOKE !== '1') {
  console.error('Set DISCORD_BRIDGE_SMOKE=1 to run the Claude proxy smoke test.');
  process.exit(1);
}

console.log('Claude proxy smoke test is not wired to real SillyTavern settings yet.');
