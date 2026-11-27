import {audit} from './db.mjs';
import {ApiError} from './http.mjs';

function failureCategory(error) {
  if (error.code === 'V4001' || error.code === 'plan_limit') return 'plan_limit';
  if (error.code === '23505' || (error instanceof ApiError && error.status === 409)) return 'conflict';
  if (error instanceof ApiError && error.status === 400) return 'invalid';
  if (['23503', '23514', '22P02', '22007', '22008', '22003'].includes(error.code)) return 'invalid';
}

export async function runCsvImport({db, tenant, member, requestId}, source, importBatch) {
  await db.query('SAVEPOINT csv_batch');
  try {
    const response = await importBatch();
    await db.query('RELEASE SAVEPOINT csv_batch');
    return response;
  } catch (error) {
    const category = failureCategory(error);
    if (!category) throw error;
    await db.query('ROLLBACK TO SAVEPOINT csv_batch');
    await audit(db, tenant, member.id, 'csv.failure.' + source + '.' + category, null, requestId);
    // The HTTP handler runs this callback after committing the failure record.
    return () => { throw error; };
  }
}
