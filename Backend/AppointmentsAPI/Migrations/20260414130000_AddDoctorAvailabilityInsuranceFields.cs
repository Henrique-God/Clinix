using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointmentsAPI.Migrations;

/// <inheritdoc />
public partial class AddDoctorAvailabilityInsuranceFields : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "AcceptsInsurance",
            schema: "appointments",
            table: "doctor_availability",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<bool>(
            name: "AcceptsPrivate",
            schema: "appointments",
            table: "doctor_availability",
            type: "boolean",
            nullable: false,
            defaultValue: true);

        migrationBuilder.AddColumn<string>(
            name: "InsurancePlans",
            schema: "appointments",
            table: "doctor_availability",
            type: "character varying(2000)",
            maxLength: 2000,
            nullable: true);
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
