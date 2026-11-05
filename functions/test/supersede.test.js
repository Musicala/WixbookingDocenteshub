process.env.HUB_TEST = "1";
const test = require("node:test");
const assert = require("node:assert/strict");
const { mismoEstudiante, soloDelMismoEstudiante } = require("../index.js").__test;
const doc = (d, id = "x") => ({ id, data: () => d });

test("Andrés Alonso: la actualización de Andrés Camilo no retira su reserva del Ensamble", () => {
  const nuevo = { bookingId: "961d", customerName: "Andrés Camilo Gutiérrez Rincón", customerEmail: "andrescamilo@gmail.com", serviceName: "MS: Ensamble", serviceType: "CLASS", status: "updated" };
  const otro = doc({ customerName: "Andrés Alonso", customerEmail: "aa.alonso572@gmail.com", serviceName: "MS: Ensamble" }, "1e7c");
  assert.deepEqual(soloDelMismoEstudiante([otro], nuevo), []);
});

test("el mismo estudiante sí se retira (cambio de docente o de hora)", () => {
  const nuevo = { bookingId: "n", customerName: "Ana", customerEmail: "ana@x.com", serviceType: "INDIVIDUAL" };
  assert.equal(soloDelMismoEstudiante([doc({ customerName: "Ana", customerEmail: "ANA@x.com" })], nuevo).length, 1);
});

test("clase grupal sin identidad en el evento: no se retira a nadie", () => {
  assert.deepEqual(soloDelMismoEstudiante([doc({ customerName: "Ana", customerEmail: "ana@x.com" })], { serviceType: "CLASS" }), []);
});

test("sin correo, por nombre exacto", () => {
  assert.equal(mismoEstudiante({ customerName: "Juan Pérez" }, { customerName: "juan pérez" }), true);
  assert.equal(mismoEstudiante({ customerName: "Juan Pérez" }, { customerName: "Juan Gómez" }), false);
});
