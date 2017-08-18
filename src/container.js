const lifetimes = require("./lifetimes")
const visibilities = require("./visibilities")
const createResolver = require("./resolver")
const getDebugInfo = require("./debug-info")

module.exports = () => {
  return {
    createContainer(containerName) {
      if (!containerName) {
        throw new Error("Must provide container name")
      }
      return _createContainer({
        containerName,
        parent: undefined,
      })
    },
  }
}

function _createContainer({
  containerName,
  parent,
}) {
  const module = {
    visibility: visibilities.PUBLIC,

    modules: {},
    factories: {},
    instances: {},
  }

  const internal = {
    resolve(id, previousDependencyPath = [], previouslySearchedContainers = []) {
      return createResolver({
        containerName,
        parent,
        rootModule: module,
        moduleContext: [],
        previousDependencyPath,
        previouslySearchedContainers,
      })[id]
    },

    getDebugInfo() {
      return getDebugInfo({
        containerName,
        parent,
        module,
      })
    },

    // return the list of visible containers, in order of traversal
    visibleScope() {
      if (!parent) {
        return [containerName]
      }
      return [containerName, ...parent.visibleScope()]
    },

    // return the path from this container to targetContainer, or undefined if targetContainer is not visible
    visiblePathToContainer(targetContainer) {
      if (targetContainer === containerName) {
        return [containerName]
      }
      if (!parent) {
        return undefined
      }
      const parentContainers = parent.visiblePathToContainer(targetContainer)
      if (parentContainers) {
        return [containerName, ...parentContainers]
      }
      return undefined
    },
  }

  function createRegistrationApi({
    modulePath, // module context to operate in
  }) {
    const registrationApi = {
      createSubModule(id, visibility) {
        const currentModule = getSubModule(modulePath, module)
        check(currentModule, id)
        currentModule.modules[id] = {
          visibility,

          modules: {},
          factories: {},
          instances: {},
        }
        return createRegistrationApi({
          modulePath: modulePath.push(id),
        })
      },

      registerFactory(id, factory, lifetime, visibility = visibilities.PRIVATE) {
        const currentModule = getSubModule(modulePath, module)

        if (typeof factory !== "function") {
          throw new Error(`Can't register '${id}' as a factory - it is not a function`)
        }
        check(currentModule, id)
        if (lifetime && !lifetimes.hasOwnProperty(lifetime)) {
          throw new Error(`Cannot register '${id}' - unknown lifetime '${lifetime}'`)
        }
        if (arguments.length >= 3 && !lifetime) {
          throw new Error(`Cannot register '${id}' - lifetime is set but not defined`)
        }
        if (!lifetime) {
          lifetime = lifetimes.TRANSIENT
        }
        currentModule.factories[id] = {
          factory,
          lifetime,
          visibility,
        }

        return registrationApi
      },

      // registerValues(values) {
      //   if (typeof values !== "object") {
      //     throw new Error("Cannot register values - not an object")
      //   }
      //   Object.keys(values).forEach((id) => registrationApi.registerValue(id, values[id]))
      //   return registrationApi
      // },

      registerValue(id, value, visibility = visibilities.PRIVATE) {
        const currentModule = getSubModule(modulePath, module)

        check(currentModule, id)
        if (value === undefined && arguments.length < 2) {
          throw new Error(`Can't register '${id}' - value not defined`)
        }
        currentModule.instances[id] = {
          instance: value,
          visibility,
        }

        return registrationApi
      },
    }
    return registrationApi
  }

  function createPublicApi() {
    const api = Object.assign(
      {},
      createRegistrationApi({modulePath: ""}),
      {
        resolve(id) {
          return internal.resolve(id)
        },

        child(containerName) {
          if (!containerName) {
            throw new Error("Must provide container name")
          }
          const path = internal.visiblePathToContainer(containerName)
          if (path) {
            const pathString = path.join(" -> ")
            throw new Error(
              `Cannot use container name '${containerName}': parent container named '${containerName}' already exists: ${pathString}`
            )
          }
          return _createContainer({
            containerName,
            parent: internal,
          })
        },

        getDebugInfo() {
          return internal.getDebugInfo()
        },
      }
    )
    return api
  }
  return createPublicApi()
}

function check(module, id) {
  if (module.factories.hasOwnProperty(id)) {
    throw new Error(`Cannot register '${id}' - already registered as a factory`)
  }
  if (module.instances.hasOwnProperty(id)) {
    throw new Error(`Cannot register '${id}' - already registered as a value`)
  }
  if (module.modules.hasOwnProperty(id)) {
    throw new Error(`Cannot register '${id}' - already registered as a module`)
  }
  if (typeof id !== "string") {
    throw new Error(`Cannot register '${id}' - ID must be a string`)
  }
}

function getSubModule(modulePath, currentModule) {
  let targetModule = currentModule
  modulePath.forEach((modId) => {
    targetModule = targetModule.modules[modId]
  })
  return targetModule
}
