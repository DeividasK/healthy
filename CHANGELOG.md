# Changelog

What changed in each release of Healthy, newest first, compiled from the
fragments in `.changes/unreleased/` by changie; see
[Releasing Healthy](docs/releasing.md).

## [2026.10.0] - 2026-10-20

### Added

- Adding a treatment now also records that you start taking it today. You can pick another day, including one still to come, or remove it.
- The journal groups treatments by time of day: morning, noon, afternoon, evening, bedtime, then those taken at any time.
- Reorder the journal: tap the reorder button, then move treatments and bundles up or down within each time of day. The order is kept on every day and syncs with your other devices.

### Changed

- Taking a treatment can no longer start before the treatment's date, and a treatment's date can't be moved past the day you started taking it.
- New doses in a regimen start as 1 tablet once a day, so you only change what differs.

### Fixed

- Cmd/Ctrl+Enter right after typing saves what you typed.
