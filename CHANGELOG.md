
# [2.0.0](https://github.com/showlotus/opencode-skill-usage/compare/08a74715dc79c8b1ad5fa8fdeb6db0b85ce1ed87...v2.0.0) (2026-11-13)

* feat!: drop opencode 1.x support and publish from version tags ([12b1a72](https://github.com/showlotus/opencode-skill-usage/commit/12b1a7284b2510e3550c14115f7aad4c5b8a414a))

### Bug Fixes

* persist skill-usage.log under ~/.config/opencode ([dbd0092](https://github.com/showlotus/opencode-skill-usage/commit/dbd0092b73c5b8e16327eb4d3c0e946ed0a8153f))

### Features

* add AI code review workflow for pull requests ([0c7a3c3](https://github.com/showlotus/opencode-skill-usage/commit/0c7a3c387e4db99aace9935bcbe62741261b1ab8))
* add issue_comment trigger and model config to code review ([5acb9a0](https://github.com/showlotus/opencode-skill-usage/commit/5acb9a0b4b69c8bf72144a06dc8e6e8cecfa57bb))
* migrate skill usage log to JSONL format ([5776d9f](https://github.com/showlotus/opencode-skill-usage/commit/5776d9fee1a1f9ce6c4040098c1a1178c1f5aa9c))
* replace source column with call_type in skill usage log ([08a7471](https://github.com/showlotus/opencode-skill-usage/commit/08a74715dc79c8b1ad5fa8fdeb6db0b85ce1ed87))
* **skill:** add execution directive and expand trigger coverage ([ddea613](https://github.com/showlotus/opencode-skill-usage/commit/ddea61332ea1468dc7c935700efbd6229308446d))
* support opencode v2 plugin API ([ef1c98e](https://github.com/showlotus/opencode-skill-usage/commit/ef1c98e2447c667e43b3cd1877555c563cb18583))

### BREAKING CHANGES

* opencode 1.x is no longer supported; pin opencode-skill-usage@1 on 1.x.
