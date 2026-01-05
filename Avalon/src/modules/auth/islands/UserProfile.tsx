/**
 * User Profile Island - Auth Module
 * 
 * Demonstrates a nested island in the auth module.
 * Located at: src/modules/auth/islands/UserProfile.tsx
 * Namespace: modules/auth
 * Qualified name: modules/auth/UserProfile
 */

import { useState } from 'preact/hooks';

interface User {
  name: string;
  email: string;
  avatar: string;
  role: string;
}

interface UserProfileProps {
  initialUser?: User;
}

const defaultUser: User = {
  name: 'Demo User',
  email: 'demo@example.com',
  avatar: '👤',
  role: 'Developer'
};

export default function UserProfile({ initialUser = defaultUser }: UserProfileProps) {
  const [user, setUser] = useState<User>(initialUser);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);

  const handleSave = () => {
    setUser({ ...user, name: editName });
    setIsEditing(false);
  };

  return (
    <div style={{
      padding: '1.5rem',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      maxWidth: '280px',
      backgroundColor: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <div style={{
          fontSize: '3rem',
          marginBottom: '0.5rem'
        }}>
          {user.avatar}
        </div>
        
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
            style={{
              padding: '0.25rem 0.5rem',
              border: '1px solid #4299e1',
              borderRadius: '4px',
              fontSize: '1rem',
              textAlign: 'center',
              width: '80%'
            }}
          />
        ) : (
          <h3 style={{ margin: '0', color: '#1a202c' }}>{user.name}</h3>
        )}
        
        <p style={{ margin: '0.25rem 0', color: '#718096', fontSize: '0.875rem' }}>
          {user.email}
        </p>
        <span style={{
          display: 'inline-block',
          padding: '0.125rem 0.5rem',
          backgroundColor: '#ebf8ff',
          color: '#2b6cb0',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: '500'
        }}>
          {user.role}
        </span>
      </div>

      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
        {isEditing ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleSave}
              style={{
                flex: 1,
                padding: '0.5rem',
                backgroundColor: '#48bb78',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditName(user.name);
              }}
              style={{
                flex: 1,
                padding: '0.5rem',
                backgroundColor: '#e2e8f0',
                color: '#4a5568',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: '#4299e1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
          >
            Edit Profile
          </button>
        )}
      </div>

      <p style={{ fontSize: '0.7rem', color: '#a0aec0', marginTop: '1rem', textAlign: 'center' }}>
        Island: modules/auth/UserProfile
      </p>
    </div>
  );
}
