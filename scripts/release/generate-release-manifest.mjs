function printHelp() {
  process.stdout.write(`Usage: node scripts/release/generate-release-manifest.mjs [options]\n\n`);
  process.stdout.write(
    `Generates an immutable release manifest from verified release artifacts.\n`,
  );
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp();
  process.exit(0);
}

process.stderr.write('Use --help to view the release manifest generator interface.\n');
process.exit(2);
