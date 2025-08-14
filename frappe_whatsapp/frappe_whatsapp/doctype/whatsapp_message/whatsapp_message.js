// Copyright (c) 2022, Shridhar Patil and contributors
// For license information, please see license.txt

frappe.ui.form.on('WhatsApp Message', {
    refresh: function(frm) {
        if (frm.doc.type == 'Incoming'){
            frm.add_custom_button(__("Reply"), function(){
                frappe.new_doc("WhatsApp Message", {"to": frm.doc.from});
            });
        }

        // Guardrail for manual (non-template) outbounds
        maybe_block_manual_send(frm);
    },

    // Re-check when these fields change
    to: function(frm) { maybe_block_manual_send(frm); },
    message_type: function(frm) { maybe_block_manual_send(frm); },
    type: function(frm) { maybe_block_manual_send(frm); },
    use_template: function(frm) { maybe_block_manual_send(frm); },
});


function maybe_block_manual_send(frm) {
    // Only apply for outgoing, non-template messages
    const isOutgoing = frm.doc.type === 'Outgoing';
    const isManual = (frm.doc.message_type !== 'Template') && (!frm.doc.use_template);
    const hasTo = !!frm.doc.to;

    // Reset UI first
    frm.enable_save();
    frm.page.clear_indicator();

    if (!(isOutgoing && isManual && hasTo)) {
        return;
    }

    frappe.call({
        method: 'frappe_whatsapp.frappe_whatsapp.doctype.whatsapp_message.whatsapp_message.can_send_freeform',
        args: { to: frm.doc.to },
        callback: function(r) {
            const res = r && r.message;
            if (!res) return;

            if (!res.allowed) {
                // Grey out/disable saving
                frm.disable_save();

                // Soft block with informative banner
                const timeLeft = res.seconds_remaining;
                let msg = __('Free-form messages are only allowed within the 24-hour window after the customer’s last message.');
                if (res.last_incoming) {
                    msg += '<br>' + __('Last incoming: {0}', [frappe.utils.escape_html(res.last_incoming)]);
                }
                msg += '<br>' + __('Use an approved WhatsApp Template to message this user outside the 24-hour window.');

                frm.dashboard.clear_headline();
                frm.dashboard.set_headline(__('24-hour window restriction'));
                frm.dashboard.set_headline_alert(msg, 'orange');

                // Optional: make content read-only to reinforce the state
                frm.set_df_property('message', 'read_only', 1);
            } else {
                // Allowed: ensure normal UX
                frm.set_df_property('message', 'read_only', 0);
                frm.enable_save();
                frm.dashboard.clear_headline();
            }
        }
    });
}
