/**
 * Repository Selector
 *
 * Shared utility for selecting between file-based and PostgreSQL repositories
 * based on the application configuration. Eliminates duplicated selection logic
 * across ProjectRepository and ServiceRepository.
 *
 * Each repository module must export the same interface:
 *   { getBackendName(), ensureReady(), ... }
 */

/**
 * Determine whether PostgreSQL repositories should be used.
 * Reads config lazily at call time to avoid caching stale config references
 * when the config module is hot-reloaded in tests.
 * @returns {boolean}
 */
function usePostgres() {
  const config = require("../config");
  return Boolean(
    (config.features && config.features.pgEnabled) ||
    (config.pg && config.pg.enabled)
  );
}

/**
 * Select the appropriate repository implementation based on config.
 * @param {object} fileRepo - File-based repository module
 * @param {object} pgRepo - PostgreSQL repository module
 * @returns {object} The selected repository module
 */
function selectRepository(fileRepo, pgRepo) {
  return usePostgres() ? pgRepo : fileRepo;
}

module.exports = {
  usePostgres,
  selectRepository,
};