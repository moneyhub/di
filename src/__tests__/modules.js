const test = require("ava")

const createContainerModule = require("../container")
const {PUBLIC, PRIVATE} = require("../visibility")

const NOOP_STREAM = {write: () => {}}
const {createContainer} = createContainerModule({stdio: NOOP_STREAM})

test("resolving a private dependency from same module", t => {
  const private = () => "privateInstance"
  const public = ({
    moduleId: {
      private,
    },
  }) => {
    return `publicInstance -> ${private}`
  }

  const container = createContainer("root")
  container
    .createModule("moduleId", PUBLIC)
      .registerFactory("private", PRIVATE, private)
      .registerFactory("public", PUBLIC, public)

  const instance = container
    .fromModule("moduleId")
    .resolve("public")

  t.is(instance, "publicInstance -> privateInstance")
})

test("nested modules", t => {
  const private = () => "privateInstance"
  const public = ({
    nested: {
      public,
    },
  }) => {
    return `publicInstance -> ${public}`
  }

  const container = createContainer("root")
  container
    .createModule("moduleId", PUBLIC)
      .registerFactory("private", PRIVATE, private)
      .registerFactory("public", PUBLIC, public)
      .createModule("nested", PRIVATE)
        .registerFactory("public", () => "nestedInstance")

  const instance = container
    .fromModule("moduleId")
    .resolve("public")

  t.is(instance, "publicInstance -> nestedInstance")

  const error = t.throws(
    () => container.resolve("moduleId.nested.public"),
    Error
  )
  t.regex(error.message, /not visible/i)
})

// TODO privacy rules
// TODO nested modules
// TODO dot-notation shorthand - ({"some.nested.module": {dep}}) => {}
// TODO the concept of SELF - ({[SELF]: {depFromSameModule}}) => {}
// TODO registration - names clashing with factories/instances
