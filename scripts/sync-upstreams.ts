import { db } from '../src/lib/server/db';
import { syncUpstreams } from '../src/lib/server/upstream-sync';

try {
	const result = await syncUpstreams();
	console.log(JSON.stringify(result));
	if (result.failed) process.exitCode = 1;
} finally {
	db.close();
}
