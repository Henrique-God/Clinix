using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointmentsAPI.Migrations;

/// <inheritdoc />
public partial class AddDoctorAvailabilityInsuranceFields : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            ALTER TABLE appointments.doctor_availability ADD COLUMN IF NOT EXISTS ""AcceptsInsurance"" boolean NOT NULL DEFAULT false;
            ALTER TABLE appointments.doctor_availability ADD COLUMN IF NOT EXISTS ""AcceptsPrivate"" boolean NOT NULL DEFAULT true;
            ALTER TABLE appointments.doctor_availability ADD COLUMN IF NOT EXISTS ""InsurancePlans"" character varying(2000);
        ");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "AcceptsInsurance",
            schema: "appointments",
            table: "doctor_availability");

        migrationBuilder.DropColumn(
            name: "AcceptsPrivate",
            schema: "appointments",
            table: "doctor_availability");

        migrationBuilder.DropColumn(
            name: "InsurancePlans",
            schema: "appointments",
            table: "doctor_availability");
    }
}
