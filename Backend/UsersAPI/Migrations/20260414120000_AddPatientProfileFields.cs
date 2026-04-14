using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UsersAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddPatientProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Cpf",
                schema: "users",
                table: "Users",
                type: "character varying(14)",
                maxLength: 14,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DateOfBirth",
                schema: "users",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HealthInsurance",
                schema: "users",
                table: "Users",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                schema: "users",
                table: "Users",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AcceptedInsurancePlans",
                schema: "users",
                table: "DoctorProfiles",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ConsultationPriceCents",
                schema: "users",
                table: "DoctorProfiles",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Cpf",
                schema: "users",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "DateOfBirth",
                schema: "users",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "HealthInsurance",
                schema: "users",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Phone",
                schema: "users",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "AcceptedInsurancePlans",
                schema: "users",
                table: "DoctorProfiles");

            migrationBuilder.DropColumn(
                name: "ConsultationPriceCents",
                schema: "users",
                table: "DoctorProfiles");
        }
    }
}
