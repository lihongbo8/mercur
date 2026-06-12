# Custom CLI Script

A custom CLI script is a function to execute through Medusa's CLI tool. This is useful when creating custom Medusa tooling to run as a CLI tool.

> Learn more about custom CLI scripts in [this documentation](https://docs.medusajs.com/learn/fundamentals/custom-cli-scripts).

## How to Create a Custom CLI Script?

To create a custom CLI script, create a TypeScript or JavaScript file under the `src/scripts` directory. The file must default export a function.

For example, create the file `src/scripts/my-script.ts` with the following content:

```ts title="src/scripts/my-script.ts"
import { 
  ExecArgs,
} from "@medusajs/framework/types"

export default async function myScript ({
  container
}: ExecArgs) {
  const productModuleService = container.resolve("product")

  const [, count] = await productModuleService.listAndCountProducts()

  console.log(`You have ${count} product(s)`)
}
```

The function receives as a parameter an object having a `container` property, which is an instance of the Medusa Container. Use it to resolve resources in your Medusa application.

---

## How to Run Custom CLI Script?

To run the custom CLI script, run the `exec` command:

```bash
npx medusa exec ./src/scripts/my-script.ts
```

---

## Custom CLI Script Arguments

Your script can accept arguments from the command line. Arguments are passed to the function's object parameter in the `args` property.

For example:

```ts
import { ExecArgs } from "@medusajs/framework/types"

export default async function myScript ({
  args
}: ExecArgs) {
  console.log(`The arguments you passed: ${args}`)
}
```

Then, pass the arguments in the `exec` command after the file path:

```bash
npx medusa exec ./src/scripts/my-script.ts arg1 arg2
```

## Dijie Role Category Seed

Use this repeatable seed to upsert the first approved platform role category:
`电商美工` / `category:ecommerce_art_designer@1`.

```bash
npx medusa exec ./src/scripts/dijie-seed-ecommerce-art-designer-category.ts
```

The seed stores category/package refs, capability refs, permission summaries,
and review facts only. It must not store Skill/Tool implementations, MCP server
code, provider keys, OAuth tokens, raw API payloads, or local filesystem paths.

## Dijie Role Capability Legacy Report

Use this read-only report before final role marketplace acceptance to find
already-approved role listings that do not yet carry the required Skill/Tool
capability integration facts.

```bash
npx medusa exec ./src/scripts/dijie-role-capability-legacy-report.ts
```

The script prints JSON with `checked`, `issueCount`, and `issues`. It does not
mutate data. To make legacy issues fail the command in CI, pass
`--fail-on-issues`.

## Dijie Legacy Role Cleanup

Use this development-only script to retire known legacy role listings before
rerunning the role marketplace acceptance flow. The default mode is dry-run.

```bash
npx medusa exec ./src/scripts/dijie-role-legacy-cleanup.ts
```

Apply cleanup:

```bash
npx medusa exec ./src/scripts/dijie-role-legacy-cleanup.ts --apply
```

If your Medusa CLI version treats `--apply` as its own option, use the
positional form:

```bash
npx medusa exec ./src/scripts/dijie-role-legacy-cleanup.ts apply
```

The cleanup archives and soft-deletes the role listings, soft-deletes matching
role product projections, and revokes active entitlements. It preserves audit
and ledger facts.
