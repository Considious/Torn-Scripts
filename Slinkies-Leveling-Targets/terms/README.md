# SLINK API and data terms

Terms are published in versioned folders and are never edited in place after
release. Each folder contains the original Word document and an accessible
Markdown transcription.

| Version | Effective date | Files |
| --- | --- | --- |
| `2026-08-14` | August 14, 2026 | [Markdown](2026-08-14/SLINK_API_Data_Terms_of_Service.md) · [Original Word document](2026-08-14/SLINK_API_Data_Terms_of_Service.docx) |

Version `2026-08-14` fingerprints:

- Markdown SHA-256: `398d720e740d2d22fc4c594c2ae7b787aa8a8e267c93a4e7c7c354eb1888f2f4`
- Original Word SHA-256: `5303acaf9a596a5799f15731faa7b55e4862172048a8474b5d18c372b6e8d99d`

When the terms change:

1. Create a new version folder instead of modifying an existing one.
2. Update the Worker's current terms version, URL, and SHA-256 fingerprint.
3. Update the userscript's current terms version and disclosure if necessary.
4. Deploy the Worker before releasing the updated userscript.

The consent ledger keeps one append-only acceptance record per Torn user,
terms version, SLINK service, and tool-specific disclosure version.
Re-authentication to the same versions does not overwrite the original
acceptance time. Accepting later overall terms or a changed service disclosure
creates a new record.
