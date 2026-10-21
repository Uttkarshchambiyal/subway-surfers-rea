# Evidence ledger

REA records are exported in `reference/rea-evidence.json`. The following index preserves evidence type and exact operation. Full parameters, limitations and identity scope remain in the JSON ledger/bundle.

| Evidence ID | Type | Operation |
|---|---|---|
| `ev_027bb47f38712434e71d65b678039b795714e5c8894ef366abd423c9799a71b9` | shipped-artifact / observed | inventory_artifact |
| `ev_05089d3a085e82511ddef8e5a2deadae9d088f968d8e98ee3ca855abf5e16f84` | shipped-artifact / observed | capture_adb_screen |
| `ev_0a12a258da995f7089d5c5438445c6ab808b0791941cd042f73622c2b99edcf7` | shipped-artifact / observed | capture_adb_screen |
| `ev_0baece7b127656155d8ec631c643ee894ccc67a8150f5fdf72a9a33fcc099327` | shipped-artifact / observed | capture_adb_screen |
| `ev_2737f0874e8fb63c250a74b48e3d6ec9b3f2e2b84b79bdb135b8439867f79e8a` | shipped-artifact / observed | start_adb_app |
| `ev_2ab211faa6b51be9104fa5d6df105bc317b2ff12cbb1c9611cc3f4c963d2585b` | shipped-artifact / observed | inspect_artifact |
| `ev_2b9e7620d341ffd66b125274ab738ba9279f1fa5101c37629fbdadd001ba98a2` | shipped-artifact / derived | inspect_analysis_view |
| `ev_40663a618585d3728a804aeb5382cefe138ecb7e264cd9df8041e736d6e66d80` | shipped-artifact / observed | stop_adb_app |
| `ev_446ff1bac00d295500a8224342b92d2430e809d751cafb813b519291fa8bcc49` | shipped-artifact / observed | capture_adb_screen |
| `ev_4fbb31b63138f5af58065d890873bf8e8896473bf81589403c341eeb4359ff53` | shipped-artifact / observed | capture_adb_screen |
| `ev_5087bc1f7c52953a6d97cc32d5b3103895bb142e120a61a770499e07fb610b76` | shipped-artifact / observed | capture_adb_screen |
| `ev_594ef06b8278562f0acc4bfaa61e0cedfacf0c7a57e45bd071f15755eab8b8d6` | shipped-artifact / observed | capture_adb_screen |
| `ev_61ffbc750877a3a772e21b5af9ad17220e5209c488dc347602ca6c92886245f7` | shipped-artifact / observed | capture_adb_screen |
| `ev_69d86b940c54543744e8bc56f1f366fbd775eaebfbecfe0aab795c3cda781707` | shipped-artifact / observed | capture_adb_screen |
| `ev_6a5fa439d9b7932b0b957faec969ac75af51091f0af71a836777cd061a6e8ae3` | shipped-artifact / observed | list_adb_devices |
| `ev_6cb50c8e9fd7275867c4c58897bb0c11847d2cb159b5d61f7e08e54802e08e7c` | shipped-artifact / observed | capture_adb_screen |
| `ev_71bb40e1a90745decb3a21c248629ccca721ef30f7a54707ae3f2282525ca5aa` | shipped-artifact / observed | capture_adb_screen |
| `ev_a14b1de6a4844c1c9ad7f8dc53a502d1cc5c30cafd69189f081400f4e980923b` | shipped-artifact / derived | inspect_analysis_view |
| `ev_a9f8ab45898675911a3fb36f70eedc1e64b6a03075e24a1959581b2390b2463a` | shipped-artifact / observed | capture_adb_screen |
| `ev_afe2a59ef29ca3b5da0f58158cc1e79971edc584cf108dd6c9896d40e37b9f18` | shipped-artifact / observed | capture_adb_screen |
| `ev_b677381edf474e923767a5a0660095e3cbf08009e6e749bd2af666391fc5bc16` | shipped-artifact / observed | read_adb_logcat |
| `ev_b8e09c0c3b778983fdb59f80d0971641ef74bc04fbfea4033067e60715669176` | shipped-artifact / observed | install_adb_package |
| `ev_d0284aa913bb27ec8b522d38960f90e34cc003bfae9af719c92c6cb9454044d8` | shipped-artifact / observed | capture_adb_screen |
| `ev_d2b4d8136aeffbb14be98afb3f2df29603cbe6e78fc807d5df1665d2669e59cf` | controlled-replay / observed | capture_browser_scenario |
| `ev_e5ebc0111e1ec75ec234c566a20ee203e112fad3fdc4802f96d35756709dbee6` | shipped-artifact / observed | capture_adb_screen |

## Analyst observations and unknowns

- **Static:** hash-verified APK identity, signer verification, manifest badging, native Unity/IL2CPP carriers and opaque config carrier names. See `investigation.md` for exact bytes and provider boundaries.
- **Runtime:** screenshot frames, menu/gameplay/results states, original process-scoped engine logs. A screenshot records one frame and has no implicit duration/cause.
- **Inference:** image-space vanishing point and runner framing from sampled frames. These are approximate and do not recover metric 3D camera parameters.
- **Unknown:** original action timings, metric speed/acceleration, exact collision bounds, pickup/magnet radius, power-up duration, scoring formula, original sound composition, original iOS internals. Recreation constants are explicit estimates.

The Chrome acquisition block is external-page controlled replay, not game runtime. ADB Evidence may have `subject: null`; the associated exact APK installation digest and declared package launch link the scoped emulator session, but individual screen captures do not independently attest application identity. Scripted gesture timestamps prove issued input attempts. They do not prove the requested in-game action happened.

Residual tuning unknown: `unk_c3f7ac3fc0585aff031fc1e1f7409d3f420a42cf0d30ef75be225deba8727c4e` (open), mutation Evidence `ev_6f5dbf52bef3a083aab36e6a4e545222df48aa2d8b1d486fd28ef4716530e4b0`. This formally retains the unavailable original numeric tuning.

## Later native/configuration evidence

The initial unknown list above describes the first acquisition pass. [Reference parameter audit](revision/reference-parameters.md) records later saved metadata/assembly and decoded UnityFS values, with artifact digests and exact fields. Successful constructor disassembly is retained as REA `ev_e53462bbf8b67bb67214a578a75596d1c06b085dce8e47eb233599a57ea20273` in `reference/native/character-motor-config-objdump-rea.json`; the separate Hopper attempt failed and supplies no successful analysis. Serialized motor values override constructor defaults. Selected serialized baselines are now established, while effective runtime tuning and modifier precedence remain unresolved. No new original-game execution was performed during this continuation.
