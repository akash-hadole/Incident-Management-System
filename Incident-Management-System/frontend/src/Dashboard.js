import React, { useEffect, useState } from "react";

function Dashboard() {
  const [data, setData] = useState([]);

  const fetchData = async () => {
    const res = await fetch("http://localhost:8080/work-items");
    const json = await res.json();
    setData(json);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2>Incidents</h2>
      {data.map((item) => (
        <div key={item.id}>
          {item.componentId} - {item.status}
        </div>
      ))}
    </div>
  );
}

export default Dashboard;