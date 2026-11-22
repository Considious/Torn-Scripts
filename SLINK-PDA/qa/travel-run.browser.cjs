// Keep the existing entry point for the expanded regression.
import('./travel-run-repair.browser.mjs').catch(error=>{console.error(error);process.exitCode=1;});
