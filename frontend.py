import streamlit as st
import requests
import json

BACKEND_URL = "http://backend:8000"

st.title("AI Application")

# Health Check
if st.button("Check System Health"):
    try:
        response = requests.get(f"{BACKEND_URL}/health")
        if response.status_code == 200:
            health_data = response.json()
            st.success(f"System Status: {health_data['status']}")
            st.info(f"Ollama: {health_data['ollama']}")
            st.info(f"Qdrant: {health_data['qdrant']}")
        else:
            st.error("System health check failed")
    except Exception as e:
        st.error(f"Error checking health: {str(e)}")

# Query LLM
st.header("Query LLM")
query_text = st.text_area("Enter your query:")
if st.button("Send Query"):
    if query_text:
        try:
            response = requests.post(
                f"{BACKEND_URL}/query",
                json={"text": query_text}
            )
            if response.status_code == 200:
                result = response.json()
                st.write("Response:")
                st.write(result["response"])
            else:
                st.error("Query failed")
        except Exception as e:
            st.error(f"Error sending query: {str(e)}")
    else:
        st.warning("Please enter a query")

# Store Vector
st.header("Store Vector")
store_text = st.text_area("Enter text to store:")
if st.button("Store"):
    if store_text:
        try:
            response = requests.post(
                f"{BACKEND_URL}/store",
                json={"text": store_text}
            )
            if response.status_code == 200:
                st.success("Text stored successfully!")
            else:
                st.error("Failed to store text")
        except Exception as e:
            st.error(f"Error storing text: {str(e)}")
    else:
        st.warning("Please enter text to store")

# Search Similar
st.header("Search Similar")
search_text = st.text_input("Enter text to search:")
if st.button("Search"):
    if search_text:
        try:
            response = requests.get(f"{BACKEND_URL}/similar/{search_text}")
            if response.status_code == 200:
                results = response.json()["results"]
                st.write("Similar texts found:")
                for idx, result in enumerate(results, 1):
                    st.write(f"{idx}. Text: {result['text']}")
                    st.write(f"   Score: {result['score']:.4f}")
            else:
                st.error("Search failed")
        except Exception as e:
            st.error(f"Error searching: {str(e)}")
    else:
        st.warning("Please enter text to search")
