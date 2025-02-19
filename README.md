# Planned Features
- **Syncable Snapshots**: you can view the same snapshots on all devices.
- Better [Diff](https://github.com/hoiheart/vue-diff): Support custom parameters, especially for split mode.

	| name | type | detault | values | description |
	| --- | --- | --- | --- | --- |
	| mode | `string` | `split` | `split`, `unified` |  |
	| theme | `string` | `dark` | `dark`, `light`, `custom${string}` | See [Custom theme](https://github.com/hoiheart/?tab=readme-ov-file#custom-theme) |
	| language | `string` | `plaintext` |  | See [Extend languages](https://github.com/hoiheart/?tab=readme-ov-file#extend-languages) |
	| prev | `string` | `''` |  | Prev code |
	| current | `string` | `''` |  | Current Code |
	| folding | `boolean` | `false` |  | Folding not different |
	| inputDelay | `number` | `0` |  | Setting up rendering debounce for changes for performance benefit (mode, prev, curr) |
	| virtualScroll | `boolean\|object` | `false` |  | *Default value when setting true :*   `{ height: 500, lineMinHeight: 24, delay: 100 }`   See [virtual scroll](https://github.com/hoiheart/?tab=readme-ov-file#virtual-scroll) |
- **Per folder settings**: you can set different backup intervals based on folders
- **Per tag settings**: you can set different backup intervals based on file tags
- **File linking**: you can track path change and renaming of files from snapshots.
- Commands to proactively make a snapshot.
- **Vault Snapshots**: make a snapshot of your whole vault that stores elsewhere, including plugins and settings.
- **Vault Diff**: Show file/folder changes.

## New Versions
> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

## Adding your plugin to the community plugin list

- Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## Improve code quality with eslint (optional)
- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code. 
- To use eslint with this project, make sure to install eslint from terminal:
  - `npm install -g eslint`
- To use eslint to analyze this project use this command:
  - `eslint main.ts`
  - eslint will then create a report with suggestions for code improvement by file and line number.
- If your source code is in a folder, such as `src`, you can use eslint with this command to analyze all files in that folder:
  - `eslint .\src\`
