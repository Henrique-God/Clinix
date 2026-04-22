import unittest
from datetime import datetime, timezone

from app.services.appointment_matching import (
    count_cancelable_appointments,
    is_cancelable_appointment,
    resolve_cancel_target,
)


class AppointmentMatchingTests(unittest.TestCase):
    def test_resolve_cancel_target_returns_single_cancellable_appointment(self):
        appointment = {
            "id": "appointment-1",
            "title": "Consulta - Ginecologia",
            "startTime": "2026-04-16T19:30:00Z",
            "status": "Accepted",
        }

        result = resolve_cancel_target(
            [appointment],
            "Cancele essa consulta que voce me retornou",
            now=datetime(2026, 4, 15, tzinfo=timezone.utc),
        )

        self.assertIsNotNone(result)
        self.assertEqual("appointment-1", result["id"])

    def test_resolve_cancel_target_matches_by_title(self):
        appointments = [
            {
                "id": "appointment-1",
                "title": "Consulta - Dermatologia",
                "startTime": "2026-04-16T19:30:00Z",
                "status": "Accepted",
            },
            {
                "id": "appointment-2",
                "title": "Consulta - Cardiologia",
                "startTime": "2026-04-17T14:00:00Z",
                "status": "Accepted",
            },
        ]

        result = resolve_cancel_target(
            appointments,
            "Quero cancelar a consulta de cardiologia",
            now=datetime(2026, 4, 15, tzinfo=timezone.utc),
        )

        self.assertIsNotNone(result)
        self.assertEqual("appointment-2", result["id"])

    def test_count_cancelable_appointments_ignores_completed_items(self):
        appointments = [
            {
                "id": "appointment-1",
                "title": "Consulta ativa",
                "startTime": "2026-04-17T14:00:00Z",
                "status": "Accepted",
            },
            {
                "id": "appointment-2",
                "title": "Consulta concluida",
                "startTime": "2026-04-10T14:00:00Z",
                "status": "Completed",
            },
        ]

        self.assertTrue(
            is_cancelable_appointment(
                appointments[0],
                now=datetime(2026, 4, 15, tzinfo=timezone.utc),
            ),
        )
        self.assertEqual(
            1,
            count_cancelable_appointments(
                appointments,
                now=datetime(2026, 4, 15, tzinfo=timezone.utc),
            ),
        )


if __name__ == "__main__":
    unittest.main()
