import { Booking } from "../models/Booking.js";
import Joi from "joi";

// TODO: write a validation schema for create/update per README.md section 2.

const createBookingSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date()
    .required()
    .greater(Joi.ref("startDate"))
    .messages({ "date.greater": "endDate must be after startDate" }),
  purpose: Joi.string().max(200),
  bookedBy: Joi.string().hex().length(24),
});

const updateBookingSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  purpose: Joi.string().max(200),
  bookedBy: Joi.string().hex().length(24),
})
  .custom((value, helpers) => {
    if (value.startDate && value.endDate && value.startDate >= value.endDate) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "any.invalid": "startDate must be before endDate",
  });

// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.
async function hasConflict(roomNumber, startDate, endDate, excludeId = null) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate },
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  const existingBooking = await Booking.findOne(query);
  return existingBooking !== null;
}

// GET /api/bookings
// TODO: implement per README.md section 3.

export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .populate("bookedBy", "name email")
      .sort({ startDate: 1 })
      .lean();

    res.json({ bookings });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).populate(
      "bookedBy",
      "name email",
    );
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json({ booking });
  } catch (err) {
    next(err);
  }
}

// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createBookingSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await hasConflict(
      value.roomNumber,
      value.startDate,
      value.endDate,
    );
    if (conflict) {
      return res.status(409).json({ message: "Booking conflict" });
    }
    const booking = await Booking.create(value);
    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateBookingSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) return res.status(400).json({ message: error.message });
    const existingBooking = await Booking.findById(req.params.id);
    if (!existingBooking)
      return res.status(404).json({ message: "Booking not found" });
    const roomNumber = value.roomNumber ?? existingBooking.roomNumber;
    const startDate = value.startDate ?? existingBooking.startDate;
    const endDate = value.endDate ?? existingBooking.endDate;
    if (startDate >= endDate) {
      return res
        .status(400)
        .json({ message: "startDate must be before endDate" });
    }
    const conflict = await hasConflict(
      roomNumber,
      startDate,
      endDate,
      req.params.id,
    );
    if (conflict) {
      return res.status(409).json({ message: "Booking conflict" });
    }
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true },
    );
    res.json({ booking: booking });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function deleteBooking(req, res, next) {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
