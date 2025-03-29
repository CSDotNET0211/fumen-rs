<div align="center">

 <a>
    <picture>
      <source height="125" media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/CSDotNET0211/fumen-rs/main/static/128x128.png">
      <img height="125" alt="fumen-rs" src="https://raw.githubusercontent.com/CSDotNET0211/fumen-rs/main/static/128x128.png">
    </picture>
  </a>
  <br>

  <a>
    <img height="20px" src="https://badgen.net/github/assets-dl/CSDotNET0211/fumen-rs">
    </a>
  <a>
    <img height="20px" src="https://badgen.net/github/license/CSDotNET0211/fumen-rs">
  </a>
</div>

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Build Instructions

To build the project, ensure you have Rust installed. Then, run the following commands:

```bash
git clone https://github.com/CSDotNET0211/fumen-rs.git
cd fumen-rs
cargo build --release
```

## Built-in Features

### Panels

- **Panel 1**: Description of panel 1.
- **Panel 2**: Description of panel 2.

### Shortcuts

- **Shortcut 1**: Description of shortcut 1.
- **Shortcut 2**: Description of shortcut 2.

### Commands

- **Command 1**: Description of command 1.
- **Command 2**: Description of command 2.

## Directory Structure

The following is an overview of the project's directory structure:

- **src/**: Contains the main source code for the project.
- **static/**: Contains static assets such as images.
- **tests/**: Contains test cases for the project.
- **target/**: Output directory for build artifacts (generated after building the project).

## Developer Information

### Adding Bot DLLs

To add custom bot DLLs:

1. Place the DLL files in the `bots/` directory.
2. Update the configuration file (`config.toml`) to include the path to the new DLLs.
3. Restart the application to load the new bots.

### Adding Image Recognition

To integrate image recognition:

1. Add the required image recognition library to the `Cargo.toml` file. For example:

   ```toml
   [dependencies]
   image = "0.23"
   ```

2. Implement the image recognition logic in the `src/image_recognition.rs` file.
3. Ensure the necessary test cases are added in the `tests/` directory to validate the functionality.

## Contact

For questions or discussions, join our Discord server: [Discord Invite Link](https://discord.gg/example).

## Support

If you enjoy this project and want to support its development, consider buying me a coffee on Ko-fi: [Ko-fi Link](https://ko-fi.com/example).
