# UX Contract

## Product context

- Audience: HR、专业部门规则维护人、基层单位管理员、整改复核人和系统管理员
- Primary jobs: 治理名称与数据、维护并审核规则、定位问题、推进整改、查看统计
- Target market(s): 中国企业内部管理
- Active locales: `zh-CN`
- Language/content register and native-review policy: 简体中文，使用稳定业务术语和动作动词
- Timezone/calendar policy: 日期按业务日期存储和展示，采用公历；统计时点使用 `YYYY-MM-DD`
- Accessibility target: WCAG 2.2 AA

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Permission model | `持证上岗统计分析系统_完整实现方案.md` §12、`src/store.ts` `can()` | Product brief / implementation contract | 2026-09-05 |
| Data lifecycle | `持证上岗统计分析系统_完整实现方案.md` §4–11、`src/types.ts` | Product brief / domain model | 2026-09-05 |
| Demo reset | `src/store.ts` `resetDemo()` | Local domain implementation | 2026-09-05 |
| Legal / regulatory copy | `关于进一步加强员工持证上岗管理的指导意见(1).pdf`、`src/data/policy.ts` | Governing text / controlled catalog | 2026-09-05 |
| Product scope and routes | `README.md`、`src/main.tsx` | Maintained project guide / route map | 2026-09-05 |

## Visual contract

- Project `DESIGN.md`: `DESIGN.md`
- Token ownership model: existing runtime canonical
- Runtime design-system/token source: `src/index.css`
- Mapping/export/adapters: semantic CSS variables → shared classes → `src/components/ui.tsx`
- Token drift gate: DESIGN lint, premium static audit, browser computed-style inspection
- Supported themes: light
- Design-context owner/review policy: update DESIGN.md and runtime owner together for durable visual changes

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native HTML `select` | UX-CONTRACT.md | native | keyboard + platform popup |
| Date | Native HTML `input[type=date]` | UX-CONTRACT.md | native | locale + keyboard + browser |
| Scrollbar | Global rules in `src/index.css` | DESIGN.md | geometry exceptions | computed style + forced colors |
| CRUD | Domain actions in `src/store.ts` plus shared `Modal` and `Button` | Product brief + UX-CONTRACT.md | stay in current workspace | unit tests + browser flow |

## Component behavior

| Component | Default | Hover | Focus | Active | Disabled | Busy | Error |
|---|---|---|---|---|---|---|---|
| Button | intent and emphasis variant | higher contrast | blue focus ring | slight compression | reduced opacity and inert | stable size | persistent nearby status |
| Icon button | 34px named control | highlight | blue focus ring | compression | reduced opacity and inert | stable size | persistent nearby status |
| Input | translucent field | stronger border | blue focus ring | n/a | reduced opacity | reserved adornment | inline text |
| Search | icon plus input | stronger surface | focus-within ring | n/a | n/a | reserved end slot | result region |
| Textarea | 88px minimum, resize none | stronger border | blue focus ring | n/a | read-only appearance | stable size | inline text |
| Table/list | semantic table and pagination | row highlight | control focus | selected view | pager boundary | stable frame | empty/result state |

## Dataset navigation

- Admin tables: bounded client pagination over the complete local demo dataset
- URL state: local demo uses component state because HashRouter search parameters and browser-local seed resets are architecture constraints; filter changes reset page 1
- Page size: 12
- Empty/no-results/error/loading treatment: stable table frame, text count for empty results, persistent status for action errors
- Back/scroll restoration: route shell owns scrolling; modal close restores trigger focus
- Selection scope: current tables have no bulk selection

## Flow ledger

| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery | Focus outcome | Source ref |
|---|---|---|---|---|---|---|---|
| Create rule | 新建草稿 | local immediate action | rule editor modal | saved rule appears in current view | persistent rule status | originating trigger | Product brief §7 |
| Edit rule | 保存草稿 | local immediate action | current rules workspace | refreshed row | persistent rule status | originating trigger | Product brief §7 |
| Search | SearchField input | local immediate filter | current workspace | result count in table/pager | clear search | search input | DESIGN.md |
| Reset demo | 确认重置 | destructive dialog | current route | restored seed state | dialog remains available until action | reset trigger | `src/store.ts` |
| Cancel/back | 取消 / 关闭 | n/a | originating context | n/a | entered local state is discarded | originating trigger | shared Modal |

## Navigation and responsive behavior

- Route document title policy: `{页面} — 持证上岗统计分析`
- Route error / 403 page behavior: MVP unknown routes return to dashboard; permission actions are hidden or disabled by `can()`
- Breadcrumb/tab/route-state policy: top-level routes use sidebar navigation; peer dataset views use `FocusTabs`
- Sidebar/drawer/bottom-sheet transformation: persistent sidebar on desktop, overlay drawer below 1024px
- Responsive table strategy: horizontal scrolling preserves comparisons; important identifiers remain in the first column
- Truncation/full-value access: primary labels and policy text wrap; compact secondary organization text may truncate in rows and is available in detail
- Focus restoration and sticky-obstruction policy: dialogs restore focus; topbar remains outside route scroll content

## Overlays and feedback

- Dialog primitive: shared `Modal` with labeled dialog semantics, Escape, focus loop, background scroll lock and focus restoration
- Destructive confirmation levels: reset demo uses app-owned danger confirmation; routine local updates commit directly
- Toast placement/duration/deduplication: no toast system in the local MVP; persistent inline status is canonical
- Alert/banner scope and persistence: action-specific status remains near the affected workspace
- Tooltip delay/dismissal: native title is limited to named icon utilities
- Unsaved-changes behavior: current local editors commit explicitly; route-level draft guard is future scope
- Layer/z-index contract: dialog 60 > sidebar 40 > topbar 30

## Async and resilience

- Mutation default: synchronous local store updates
- Idempotency and duplicate-submit policy: action buttons invoke one local mutation per activation
- Offline/read-stale/write behavior: browser-local dataset remains available offline
- Retry/backoff/timeout behavior: remote transport is outside current MVP
- Stale-request cancellation/invalidation and pending-state ownership: searches are local and synchronous
- Dialog/form preservation and retry after mutation failure: inline status remains in the current workspace

## Validation

- Schema/validation layer: import validation in `src/engine/validate.ts`; rule safety in `src/engine/conflict.ts`
- Trigger timing: validate on explicit import, save, submit or review actions
- Error summary/inline policy: action-specific persistent message near the owning workspace
- Sensitive-value handling: current demo contains no secret inputs
- `noValidate`, first-invalid focus, duplicate-submit prevention, unsaved changes, and submit recovery: current editors use explicit local controls rather than native form submission

## Permission and clipboard

- Permission UI strategy: actions are hidden when they do not apply and disabled where visibility explains the role boundary
- Clipboard copy policy: no clipboard actions in current scope
- Disabled-state explanation: surrounding role and task context identifies available actions

## Migration status

- Migration ledger location: this contract and current task diff
- Canonical primitives and owners: `PageHeader`, `FocusTabs`, `SearchField`, `Button`, `Modal`, `Pager`
- Current risk-prioritized slices:制度标准、规则中心、问题中心的信息聚焦；原生确认框替换
- Legacy import/token enforcement: shared components and global CSS are the supported path
- Rollout/rollback and removal gates: build, tests, premium audit and browser verification before release

## Verification

- Required static commands: `npm run build`, `npm test`, `git diff --check`, premium strict audit
- Browser/device/locale/theme matrix: desktop 1280px, narrow 390px, `zh-CN`, light, reduced motion
- Accessibility checks: keyboard focus, modal Escape/focus return, semantic controls, visible scrollbars
- Canonical sibling flow used for comparison:人员持证列表与统计报表分页视图
- Project audit command/result: generated during UI verification
- CRUD full-flow evidence: local rule and reset interactions in browser
- Failure-path evidence: rule conflict persistent status and empty search results
