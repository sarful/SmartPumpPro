const Module = require("module");

function clearModuleCache(resolvedPath) {
  delete require.cache[resolvedPath];
}

async function withModuleMocks(targetPath, mocks, run) {
  const originalLoad = Module._load;
  const resolvedTarget = require.resolve(targetPath);

  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  clearModuleCache(resolvedTarget);

  try {
    const loaded = require(targetPath);
    return await run(loaded);
  } finally {
    clearModuleCache(resolvedTarget);
    Module._load = originalLoad;
  }
}

module.exports = { withModuleMocks };
