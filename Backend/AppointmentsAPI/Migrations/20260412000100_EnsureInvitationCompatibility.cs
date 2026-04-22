using AppointmentsAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointmentsAPI.Migrations;

[DbContext(typeof(AppointmentsDbContext))]
[Migration("20260412000100_EnsureInvitationCompatibility")]
public class EnsureInvitationCompatibility : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'appointments'
                      AND table_name = 'appointment_invitation_metadata'
                      AND column_name = 'InvitedByDoctorId'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'appointments'
                      AND table_name = 'appointment_invitation_metadata'
                      AND column_name = 'InvitedByUserId'
                ) THEN
                    ALTER TABLE appointments.appointment_invitation_metadata
                    RENAME COLUMN "InvitedByDoctorId" TO "InvitedByUserId";
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'appointments'
                      AND table_name = 'appointment_invitation_metadata'
                      AND column_name = 'PatientResponseNote'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'appointments'
                      AND table_name = 'appointment_invitation_metadata'
                      AND column_name = 'ResponseNote'
                ) THEN
                    ALTER TABLE appointments.appointment_invitation_metadata
                    RENAME COLUMN "PatientResponseNote" TO "ResponseNote";
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'appointments'
                      AND table_name = 'appointment_invitation_metadata'
                      AND column_name = 'InvitedByRole'
                ) THEN
                    ALTER TABLE appointments.appointment_invitation_metadata
                    ADD COLUMN "InvitedByRole" integer NOT NULL DEFAULT 2;
                END IF;
            END
            $$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
