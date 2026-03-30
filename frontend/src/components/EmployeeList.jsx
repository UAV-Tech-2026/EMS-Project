import { useEffect, useState } from "react";
import axios from "axios";
import "./EmployeesList.css";

export default function EmployeesList({ token }) {
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/employees`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setEmployees(res.data);
      } catch (err) {
        console.error("Error fetching employees:", err.response?.data || err.message);
      }
    };

    if (token) fetchEmployees();
  }, [token]);

  return (
    <div className="employees-container">
      <h2>Employees List</h2>

      <table className="employees-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Designation</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <tr key={emp.id}>
              <td>{emp.id}</td>
              <td>{emp.name}</td>
              <td>{emp.email}</td>
              <td>{emp.designation || "N/A"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
