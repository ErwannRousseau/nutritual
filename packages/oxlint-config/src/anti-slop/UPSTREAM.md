This package vendors the generic Oxlint plugin from
https://github.com/dmmulroy/anti-slop at commit
`13909c9e07590f5a85d93c62712259fe14a883f7`.

The vendored plugin entry point is `index.ts`, with its rules under `rules/`.
It is exposed to workspace configs as
`@nutritual/oxlint-config/anti-slop`. The rule set is maintained in the parent
package's `src/index.ts`. No upstream rules were intentionally omitted from the
generic plugin copy. The upstream project is licensed under MIT; see `LICENSE`.
