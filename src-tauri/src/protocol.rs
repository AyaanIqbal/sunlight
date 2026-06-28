use aes::cipher::{generic_array::GenericArray, BlockEncrypt, KeyInit};
use aes::Aes128;

// From the working Python script
const AES_KEY: [u8; 16] = [
    0x34, 0x52, 0x2A, 0x5B, 0x7A, 0x6E, 0x49, 0x2C,
    0x08, 0x09, 0x0A, 0x9D, 0x8D, 0x2A, 0x23, 0xF8,
];

pub fn build_command(r: u8, g: u8, b: u8, brightness: u8) -> [u8; 16] {
    [
        0x54, 0x52, 0x00, 0x57,
        0x02,
        0x01,
        0x00,
        r, g, b,
        brightness,
        0x40,
        0x00,
        0x00, 0x00, 0x00,
    ]
}

pub fn encrypt_command(plaintext: &[u8; 16]) -> [u8; 16] {
    let cipher = Aes128::new(&GenericArray::from(AES_KEY));
    let mut block = GenericArray::from(*plaintext);
    cipher.encrypt_block(&mut block);
    block.into()
}

pub fn make_color_packet(r: u8, g: u8, b: u8, brightness: u8) -> [u8; 16] {
    let cmd = build_command(r, g, b, brightness);
    encrypt_command(&cmd)
}
