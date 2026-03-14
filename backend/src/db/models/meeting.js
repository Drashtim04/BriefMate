const mongoose = require('mongoose');

const MeetingSchema = new mongoose.Schema(
  {
    orgId: { type: String, required: true, index: true },
    meetingId: { type: String, required: true, index: true },
    employeeEmail: { type: String, required: true, index: true },
    meetingAt: { type: Date, required: true, index: true },

    title: { type: String, default: null },
    summary: { type: String, default: null },
    participants: { type: [String], default: null },
    transcript: { type: [mongoose.Schema.Types.Mixed], default: null }
  },
  { collection: 'meetings' }
);

MeetingSchema.index(
  { orgId: 1, meetingId: 1 },
  {
    unique: true,
    partialFilterExpression: { meetingId: { $type: 'string' } },
    name: 'uq_meeting_id'
  }
);
MeetingSchema.index({ orgId: 1, employeeEmail: 1, meetingAt: -1 }, { name: 'ix_meetings_employee_date' });
MeetingSchema.index({ orgId: 1, meetingAt: -1 }, { name: 'ix_meetings_date' });

module.exports = mongoose.model('Meeting', MeetingSchema);