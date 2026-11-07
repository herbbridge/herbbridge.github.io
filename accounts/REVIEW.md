# Doctor/patient review version

Fictional patient information only. This version connects to the Singapore development project, not a production patient service.

## Implemented

Email-confirmed patient/practitioner accounts; operator-reviewed practitioner approval; private rooms; practitioner invitation codes; patient-controlled view/edit access; limits of three practitioners per patient and twenty patients per practitioner; versioned lists; author history; conflict handling; English and Traditional Chinese; larger text.

## Review limits

Practitioners remain pending until reviewed. Custom email delivery is configured. Confirmation and recovery support cross-browser links and email codes once the hosted email templates are enabled. Real two-account/two-device verification remains pending. Independent-session races have been tested locally; hosted race verification remains pending. Reminders, timers and notifications are design demonstrations only. Patient-created invitations, QR invitations and integration with the guest medicine checker remain unfinished. No real patient information.

The design walkthrough at ./design/ is a separate fictional simulation; it creates no account and sends no medical data.

Source snapshot: ../tools/care-accounts/. To rebuild from that snapshot, set HERBBRIDGE_SITE_ROOT to the repository root and supply the labelled design source at the canonical workspace location. Canonical workspace source: 05_Backend/. No secrets are included.
