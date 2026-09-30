import React, { useState, useEffect } from "react";
import API from "../services/api";

const EmergencyContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  
  // Form states
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [priority, setPriority] = useState(3);
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await API.get("/contacts");
      if (res.data?.success) {
        setContacts(res.data.contacts || []);
      }
    } catch (err) {
      console.error("Failed to load contacts:", err);
      setError("Unable to fetch emergency contacts list.");
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingContact(null);
    setName("");
    setRelation("");
    setPhone("");
    setEmail("");
    setPriority(3);
    setIsPrimary(false);
    setError("");
    setIsModalOpen(true);
  };

  const openEditModal = (contact) => {
    setEditingContact(contact);
    setName(contact.name || "");
    setRelation(contact.relation || "");
    setPhone(contact.phone || "");
    setEmail(contact.email || "");
    setPriority(contact.priority || 3);
    setIsPrimary(contact.isPrimary || false);
    setError("");
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingContact(null);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name || !relation || (!phone && !email)) {
      setError("Name, relationship, and an email or phone number are required.");
      return;
    }

    const payload = {
      name,
      relation,
      phone,
      email,
      priority: Number(priority),
      isPrimary,
    };

    try {
      setSubmitLoading(true);
      if (editingContact) {
        // Edit contact
        const res = await API.put(`/contacts/${editingContact._id}`, payload);
        if (res.data?.success) {
          setSuccess("Emergency contact updated successfully!");
          handleModalClose();
          fetchContacts();
        }
      } else {
        // Add new contact
        const res = await API.post("/contacts", payload);
        if (res.data?.success) {
          setSuccess("Emergency contact added successfully!");
          handleModalClose();
          fetchContacts();
        }
      }
    } catch (err) {
      console.error("Submit contact error:", err);
      setError(err.response?.data?.message || "Failed to save emergency contact details.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteContact = async (id) => {
    if (!window.confirm("Are you sure you want to delete this emergency contact?")) {
      return;
    }

    try {
      setError("");
      setSuccess("");
      const res = await API.delete(`/contacts/${id}`);
      if (res.data?.success) {
        setSuccess("Emergency contact deleted successfully!");
        fetchContacts();
      }
    } catch (err) {
      console.error("Delete contact error:", err);
      setError("Failed to delete contact.");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1>Emergency Contacts</h1>
          <p>Add up to 5 priority contacts who will receive emergency emails.</p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary">
          ➕ Add Contact
        </button>
      </div>

      {error && <div className="alert-banner alert-banner-danger">{error}</div>}
      {success && <div className="alert-banner alert-banner-success">{success}</div>}

      {loading ? (
        <div className="spinner"></div>
      ) : contacts.length === 0 ? (
        <div className="empty-state">
          <h3>No contacts configured</h3>
          <p style={{ marginTop: "8px" }}>Click "Add Contact" to save your first emergency recipient.</p>
        </div>
      ) : (
        <div className="contacts-grid">
          {contacts.map((contact) => (
            <div key={contact._id} className="card" style={{ borderLeft: contact.isPrimary ? "4px solid var(--accent-amber)" : "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div>
                  <h3 style={{ fontSize: "18px" }}>{contact.name}</h3>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
                    {contact.relation}
                  </span>
                </div>
                {contact.isPrimary && (
                  <span className="badge badge-pending" style={{ fontSize: "9px" }}>
                    Primary
                  </span>
                )}
              </div>
              
              <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {contact.phone && <div>📞 {contact.phone}</div>}
                {contact.email && <div style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>✉️ {contact.email}</div>}
                <div>⭐ Priority: {contact.priority}</div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => openEditModal(contact)} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                  ✏️ Edit
                </button>
                <button onClick={() => handleDeleteContact(contact._id)} className="btn btn-danger btn-sm" style={{ flex: 1 }}>
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingContact ? "Edit Contact" : "Add Emergency Contact"}</h2>
              <button onClick={handleModalClose} className="modal-close">
                &times;
              </button>
            </div>

            {error && <div className="alert-banner alert-banner-danger" style={{ marginBottom: "16px" }}>{error}</div>}

            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Relationship</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Mother, Friend, Spouse"
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="e.g. +1234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="e.g. jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Priority (1 to 5, 1 is highest)</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="5"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  id="isPrimaryCheckbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                />
                <label htmlFor="isPrimaryCheckbox" style={{ fontSize: "14px", color: "var(--text-primary)", cursor: "pointer" }}>
                  Designate as Primary Emergency Contact
                </label>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
                <button type="button" onClick={handleModalClose} className="btn btn-secondary" style={{ flex: 1 }} disabled={submitLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitLoading}>
                  {submitLoading ? "Saving..." : "Save Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyContacts;
